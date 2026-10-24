// POST /api/map/update：前回から変わったワークスペースのファイルと取り込んだ判定から、
// マップへの変更の一覧（MapOp[]）を返す（F-15）。マップへの当てはめは画面側（applyMapOps）が行う。

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { MapUpdateResponse } from "@/lib/api-types";
import { fetchCommits, GithubApiError, parseRepo, parseSha } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { enrichMap, suggestImpactLinks } from "@/lib/llm/map";
import { LlmError } from "@/lib/llm/structured";
import { diffToOps, reviewLinkOps } from "@/lib/map/merge";
import type { MapOp, Review, WorkflowMap } from "@/lib/types";
import {
  changedPathsSince,
  fetchWorkspaceFiles,
  fetchWorkspaceHead,
  MAX_WORKSPACE_FILES,
} from "@/lib/workspace/github";
import {
  parseDoc,
  parseMilestones,
  selectWorkspacePaths,
  type WorkspaceDoc,
} from "@/lib/workspace/parse";
import { buildSkeleton } from "@/lib/workspace/skeleton";
import { withLlm } from "@/lib/llm/route";

export const runtime = "nodejs";
export const maxDuration = 120;

// マップと判定は、ここで使う項目だけを確かめる（ほかの項目はそのまま通す）
const requestSchema = z.object({
  theme: z.object({
    name: z.string(),
    question: z.string(),
    method: z.string(),
    evaluation: z.string(),
  }),
  repo: z.string(),
  map: z
    .object({
      themeId: z.string(),
      workspaceRepo: z.string().optional(),
      workspaceProject: z.string().optional(),
      workspaceSha: z.string().optional(),
      phases: z.array(z.looseObject({})),
      milestones: z.array(z.looseObject({})),
      tasks: z.array(
        z.looseObject({
          id: z.string(),
          key: z.string().optional(),
          commitShas: z.array(z.string()),
        }),
      ),
      links: z.array(z.looseObject({})),
      rejected: z.array(z.looseObject({})),
      appliedReviewIds: z.array(z.string()),
    })
    .loose(),
  review: z
    .looseObject({
      id: z.string(),
      commitSha: z.string(),
      findings: z.array(z.looseObject({})),
    })
    .optional(),
});

function isValidProject(project: string): boolean {
  return (
    project !== "." &&
    project !== ".." &&
    !project.includes("/") &&
    !project.includes("\\")
  );
}

async function handlePost(request: Request) {
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
  const theme = parsed.data.theme;
  const map = parsed.data.map as unknown as WorkflowMap;
  const review = parsed.data.review as unknown as Review | undefined;

  const workspaceProject = map.workspaceProject?.trim();
  if (!map.workspaceRepo?.trim() || !workspaceProject || !map.workspaceSha?.trim()) {
    return jsonError(
      "このマップはワークスペースから作られていないため、更新できません",
      400,
    );
  }
  if (!isValidProject(workspaceProject)) {
    return jsonError("プロジェクト名に使えない文字が含まれています", 400);
  }

  try {
    const implRepo = parseRepo(parsed.data.repo);
    const workspaceRepo = parseRepo(map.workspaceRepo);
    const baseSha = parseSha(map.workspaceSha);

    // 前回から変わったワークスペースのファイルだけを読む
    const head = await fetchWorkspaceHead(workspaceRepo);
    const changedPaths =
      head.toLowerCase() === baseSha
        ? []
        : await changedPathsSince(workspaceRepo, baseSha, head);
    const paths = selectWorkspacePaths(changedPaths, workspaceProject).slice(
      0,
      MAX_WORKSPACE_FILES,
    );
    const files = await fetchWorkspaceFiles(workspaceRepo, head, paths);

    const changedDocs = files
      .map((file) => parseDoc(file, workspaceProject))
      .filter((doc): doc is WorkspaceDoc => doc !== undefined);

    // 変わったドキュメントがリンクしている、マップに既にあるドキュメント（隣）も読む。
    // 骨格は両端のドキュメントがそろったときだけ flow を引くため、隣が無いと「新しい spec → 前からある壁打ち」が抜ける
    const mapKeys = new Set(map.tasks.flatMap((t) => (t.key ? [t.key] : [])));
    const changedSet = new Set(changedDocs.map((d) => d.path));
    const neighborPaths = [
      ...new Set(changedDocs.flatMap((d) => d.links)),
    ].filter((p) => mapKeys.has(p) && !changedSet.has(p));
    const neighborDocs = (
      await fetchWorkspaceFiles(workspaceRepo, head, neighborPaths)
    )
      .map((file) => parseDoc(file, workspaceProject))
      .filter((doc): doc is WorkspaceDoc => doc !== undefined);
    const docs = [...changedDocs, ...neighborDocs];
    // README.md が変わったときだけ、マイルストーンを読み直す
    const readme = files.find(
      (file) => file.path === `.research/lab/projects/${workspaceProject}/README.md`,
    );
    const milestones = readme ? parseMilestones(readme.text) : [];

    // マップにまだ無い実装のコミット（と、取り込んだ判定のコミット、変わったドキュメントが参照しているコミット）だけを渡す。
    // 参照されているコミットは、マップに既にあっても渡す（spec → コミットの flow を引くため。差分では結び付けだけになる）
    const known = new Set(
      map.tasks.flatMap((t) => t.commitShas.map((s) => s.toLowerCase())),
    );
    const referenced = changedDocs.flatMap((d) => d.commits);
    const reviewSha = review?.commitSha.toLowerCase() ?? "";
    const { commits } = await fetchCommits(implRepo);
    const newCommits = commits
      .filter((c) => {
        const sha = c.sha.toLowerCase();
        if (reviewSha !== "" && sha === reviewSha) return true;
        if (referenced.some((r) => sha.startsWith(r))) return true;
        for (const k of known) {
          if (k !== "" && sha.startsWith(k)) return false;
        }
        return true;
      })
      .map((c) => ({ sha: c.sha, message: c.message, url: c.url, date: c.date }));

    const partial = buildSkeleton({
      themeId: map.themeId,
      workspaceRepo: `${workspaceRepo.owner}/${workspaceRepo.name}`,
      workspaceProject,
      workspaceSha: head,
      docs,
      milestones,
      commits: newCommits,
      now: new Date().toISOString(),
    });

    // 隣のドキュメントは、今のマップの目的を引き継ぐ（AI に書き直させず、差分にも出さない）
    const purposeByKey = new Map(
      map.tasks.flatMap((t) => (t.key && !changedSet.has(t.key) ? [[t.key, t.purpose]] : [])),
    );
    const draft = {
      ...partial,
      tasks: partial.tasks.map((t) => {
        const purpose = t.key ? purposeByKey.get(t.key) : undefined;
        return purpose ? { ...t, purpose } : t;
      }),
    };

    // キーが無いときは AI を飛ばす（目的は空のまま）
    const hasAi = Boolean(process.env.ANTHROPIC_API_KEY);
    const fresh =
      hasAi && draft.tasks.length > 0
        ? await enrichMap({ theme, map: draft, docs })
        : draft;

    const ops: MapOp[] = diffToOps(map, fresh);

    if (review) {
      // 判定のコミットが今回マップに加わるときは、そのタスクに判定を結び付ける
      if (review.commitSha !== "") {
        for (const op of ops) {
          if (
            op.op === "add_task" &&
            op.commitShas.some((s) => s.toLowerCase() === reviewSha) &&
            !op.reviewIds.includes(review.id)
          ) {
            op.reviewIds = [...op.reviewIds, review.id];
          }
        }
      }
      ops.push(...reviewLinkOps(map, review));

      // 影響の矢印を AI に選ばせる。新しく加わるタスクも選び先に入れる
      if (hasAi) {
        const existingKeys = new Set(map.tasks.map((t) => t.key));
        const newTasks = fresh.tasks.filter(
          (t) => t.key !== undefined && !existingKeys.has(t.key),
        );
        const impactLinks = await suggestImpactLinks({
          theme,
          map: { ...map, tasks: [...map.tasks, ...newTasks] },
          review,
        });
        ops.push(...impactLinks);
      }
    }

    return NextResponse.json<MapUpdateResponse>({ ops, workspaceSha: head });
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
      "[api/map/update] マップの更新に失敗しました:",
      e instanceof Error ? e.message : "unknown error",
    );
    return jsonError(
      "マップの更新中にエラーが起きました。もう一度試してください",
      500,
    );
  }
}

// モデル・エフォートをヘッダーで受け取り、使用量をヘッダーで返す（F-17）
export const POST = withLlm(handlePost);
