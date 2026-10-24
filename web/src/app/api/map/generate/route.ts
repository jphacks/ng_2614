// POST /api/map/generate：research-workspace と実装リポジトリを読んで、作業フローマップを作る（F-15）。
// 骨格は AI を使わずに作り、ANTHROPIC_API_KEY があれば目的などを AI で補う。

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { MapGenerateResponse } from "@/lib/api-types";
import { fetchCommits, GithubApiError, parseRepo } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { enrichMap } from "@/lib/llm/map";
import { LlmError } from "@/lib/llm/structured";
import {
  fetchWorkspaceFiles,
  fetchWorkspaceHead,
  listWorkspacePaths,
  MAX_WORKSPACE_FILES,
} from "@/lib/workspace/github";
import {
  parseDoc,
  parseMilestones,
  selectWorkspacePaths,
  type WorkspaceDoc,
} from "@/lib/workspace/parse";
import { buildSkeleton } from "@/lib/workspace/skeleton";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  themeId: z.string().min(1),
  theme: z.object({
    name: z.string(),
    question: z.string(),
    method: z.string(),
    evaluation: z.string(),
  }),
  repo: z.string(),
  workspaceRepo: z.string().optional(),
  workspaceProject: z.string().optional(),
});

// プロジェクト名はパスの一部になるので、区切りや ".." は受け付けない
function isValidProject(project: string): boolean {
  return (
    project !== "." &&
    project !== ".." &&
    !project.includes("/") &&
    !project.includes("\\")
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(
      "リクエストの形式が正しくありません（JSON を送ってください）",
      400,
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join(" / ");
    return jsonError(`リクエストの内容が正しくありません。${detail}`, 400);
  }
  const req = parsed.data;

  const workspaceProject = req.workspaceProject?.trim();
  if (!req.workspaceRepo?.trim() || !workspaceProject) {
    return jsonError(
      "マップを作るには、research-workspace のリポジトリとプロジェクト名を指定してください",
      400,
    );
  }
  if (!isValidProject(workspaceProject)) {
    return jsonError("プロジェクト名に使えない文字が含まれています", 400);
  }

  try {
    const implRepo = parseRepo(req.repo);
    const workspaceRepo = parseRepo(req.workspaceRepo);

    const head = await fetchWorkspaceHead(workspaceRepo);
    const allPaths = await listWorkspacePaths(workspaceRepo, head);
    const paths = selectWorkspacePaths(allPaths, workspaceProject).slice(
      0,
      MAX_WORKSPACE_FILES,
    );
    const files = await fetchWorkspaceFiles(workspaceRepo, head, paths);

    const docs = files
      .map((file) => parseDoc(file, workspaceProject))
      .filter((doc): doc is WorkspaceDoc => doc !== undefined);
    const readme = files.find(
      (file) => file.path === `.research/lab/projects/${workspaceProject}/README.md`,
    );
    const milestones = readme ? parseMilestones(readme.text) : [];

    const { commits } = await fetchCommits(implRepo);

    const skeleton = buildSkeleton({
      themeId: req.themeId,
      workspaceRepo: `${workspaceRepo.owner}/${workspaceRepo.name}`,
      workspaceProject,
      workspaceSha: head,
      docs,
      milestones,
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        url: c.url,
        date: c.date,
      })),
      now: new Date().toISOString(),
    });

    // キーが無いときは AI を飛ばして骨格だけ返す（目的は空のまま）
    const map = process.env.ANTHROPIC_API_KEY
      ? await enrichMap({ theme: req.theme, map: skeleton, docs })
      : skeleton;
    return NextResponse.json<MapGenerateResponse>({ map });
  } catch (e) {
    if (e instanceof GithubApiError) return jsonError(e.message, e.status);
    if (e instanceof LlmError) return jsonError(e.message, 502);
    if (e instanceof Anthropic.RateLimitError) {
      return jsonError(
        "AI の利用が混み合っています。少し待ってからもう一度試してください",
        429,
      );
    }
    // 機密情報を出さないよう、メッセージだけを記録する
    console.error(
      "[api/map/generate] マップの作成に失敗しました:",
      e instanceof Error ? e.message : "unknown error",
    );
    return jsonError(
      "マップの作成中にエラーが起きました。もう一度試してください",
      500,
    );
  }
}
