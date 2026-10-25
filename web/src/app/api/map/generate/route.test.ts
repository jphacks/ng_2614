import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError, MapGenerateResponse } from "@/lib/api-types";
import { GithubApiError } from "@/lib/github";
import type { WorkflowMap } from "@/lib/types";
import type { WorkspaceDoc } from "@/lib/workspace/parse";

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return { ...actual, fetchCommits: vi.fn() };
});
vi.mock("@/lib/workspace/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspace/github")>();
  return {
    ...actual,
    fetchWorkspaceHead: vi.fn(),
    listWorkspacePaths: vi.fn(),
    fetchWorkspaceFiles: vi.fn(),
  };
});
vi.mock("@/lib/workspace/parse", () => ({
  selectWorkspacePaths: vi.fn(),
  parseDoc: vi.fn(),
  parseMilestones: vi.fn(),
}));
vi.mock("@/lib/workspace/skeleton", () => ({ buildSkeleton: vi.fn() }));
vi.mock("@/lib/llm/map", () => ({
  enrichMap: vi.fn(),
  suggestImpactLinks: vi.fn(),
}));

import { fetchCommits } from "@/lib/github";
import { LlmError } from "@/lib/llm/structured";
import { enrichMap } from "@/lib/llm/map";
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
} from "@/lib/workspace/parse";
import { buildSkeleton } from "@/lib/workspace/skeleton";
import { POST } from "./route";

const mockedCommits = vi.mocked(fetchCommits);
const mockedHead = vi.mocked(fetchWorkspaceHead);
const mockedList = vi.mocked(listWorkspacePaths);
const mockedFiles = vi.mocked(fetchWorkspaceFiles);
const mockedSelect = vi.mocked(selectWorkspacePaths);
const mockedParseDoc = vi.mocked(parseDoc);
const mockedMilestones = vi.mocked(parseMilestones);
const mockedSkeleton = vi.mocked(buildSkeleton);
const mockedEnrich = vi.mocked(enrichMap);

const HEAD = "c".repeat(40);
const README = ".research/lab/projects/ddpm/README.md";

const THEME = {
  name: "拡散モデル",
  question: "ノイズスケジュールで品質は変わるか",
  method: "DDPM",
  evaluation: "FID",
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    themeId: "t1",
    theme: THEME,
    repo: "me/impl",
    workspaceRepo: "me/research-workspace",
    workspaceProject: "ddpm",
    ...overrides,
  };
}

function post(payload: unknown, raw = false): Promise<Response> {
  return POST(
    new Request("http://localhost:3000/api/map/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (payload as string) : JSON.stringify(payload),
    }),
  );
}

function doc(path: string): WorkspaceDoc {
  return {
    path,
    kind: "spec",
    title: path,
    frontmatter: {},
    links: [],
    commits: [],
    headings: [],
    excerpt: "",
  };
}

const SKELETON = { themeId: "t1", tasks: [], purpose: "骨格" } as unknown as WorkflowMap;
const ENRICHED = { themeId: "t1", tasks: [], purpose: "補った" } as unknown as WorkflowMap;

const originalKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-ant-dummy-for-tests";
  mockedHead.mockResolvedValue(HEAD);
  mockedList.mockResolvedValue([README, "other.md"]);
  mockedSelect.mockReturnValue([README, ".research/lab/projects/ddpm/specs/a.md"]);
  mockedFiles.mockResolvedValue([
    { path: README, text: "# README\n- [x] M1" },
    { path: ".research/lab/projects/ddpm/specs/a.md", text: "# spec" },
  ]);
  mockedParseDoc.mockImplementation((file) =>
    file.path === README ? undefined : doc(file.path),
  );
  mockedMilestones.mockReturnValue([{ title: "M1", done: true }]);
  mockedCommits.mockResolvedValue({
    commits: [
      {
        sha: "d".repeat(40),
        message: "feat: 実装",
        author: "me",
        date: "2026-10-24T00:00:00Z",
        url: "https://github.com/me/impl/commit/d",
      },
    ],
  });
  mockedSkeleton.mockReturnValue(SKELETON);
  mockedEnrich.mockResolvedValue(ENRICHED);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
});

describe("POST /api/map/generate の入力の検証", () => {
  it("JSON でない本文は 400", async () => {
    const res = await post("{not json", true);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toContain("JSON");
  });

  it("theme や repo が無ければ 400", async () => {
    const res = await post({ themeId: "t1" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toContain("theme");
  });

  it.each([
    ["workspaceRepo が無い", { workspaceRepo: undefined }],
    ["workspaceProject が無い", { workspaceProject: undefined }],
    ["workspaceRepo が空", { workspaceRepo: " " }],
    ["workspaceProject が空", { workspaceProject: "" }],
  ])("%s と 400", async (_, overrides) => {
    const res = await post(body(overrides));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toBeTruthy();
    expect(mockedHead).not.toHaveBeenCalled();
  });

  it.each(["../x", "a/b", "..", "a\\b"])(
    "プロジェクト名 %s は 400",
    async (workspaceProject) => {
      const res = await post(body({ workspaceProject }));
      expect(res.status).toBe(400);
      expect(mockedHead).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["repo", { repo: "not a repo" }],
    ["workspaceRepo", { workspaceRepo: "x/y/z" }],
  ])("%s が owner/name でなければ GitHub を呼ばずに 400", async (_, overrides) => {
    const res = await post(body(overrides));
    expect(res.status).toBe(400);
    expect(mockedHead).not.toHaveBeenCalled();
    expect(mockedCommits).not.toHaveBeenCalled();
  });
});

describe("POST /api/map/generate の流れ", () => {
  it("読んだものから骨格を作り、AI で補ったマップを返す", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(((await res.json()) as MapGenerateResponse).map).toEqual(ENRICHED);

    expect(mockedHead).toHaveBeenCalledWith({
      owner: "me",
      name: "research-workspace",
    });
    expect(mockedList).toHaveBeenCalledWith(
      { owner: "me", name: "research-workspace" },
      HEAD,
    );
    expect(mockedSelect).toHaveBeenCalledWith([README, "other.md"], "ddpm");
    expect(mockedFiles).toHaveBeenCalledWith(
      { owner: "me", name: "research-workspace" },
      HEAD,
      [README, ".research/lab/projects/ddpm/specs/a.md"],
    );
    expect(mockedCommits).toHaveBeenCalledWith({ owner: "me", name: "impl" });

    // undefined の doc は除く。README.md からマイルストーンを読む
    expect(mockedMilestones).toHaveBeenCalledWith("# README\n- [x] M1");
    const input = mockedSkeleton.mock.calls[0][0];
    expect(input.docs.map((d) => d.path)).toEqual([
      ".research/lab/projects/ddpm/specs/a.md",
    ]);
    expect(input).toMatchObject({
      themeId: "t1",
      workspaceRepo: "me/research-workspace",
      workspaceProject: "ddpm",
      workspaceSha: HEAD,
      milestones: [{ title: "M1", done: true }],
      commits: [
        {
          sha: "d".repeat(40),
          message: "feat: 実装",
          url: "https://github.com/me/impl/commit/d",
          date: "2026-10-24T00:00:00Z",
        },
      ],
    });
    expect(Number.isNaN(Date.parse(input.now))).toBe(false);

    expect(mockedEnrich).toHaveBeenCalledTimes(1);
    const enrichInput = mockedEnrich.mock.calls[0][0];
    expect(enrichInput.theme).toEqual(THEME);
    expect(enrichInput.map).toBe(SKELETON);
    expect(enrichInput.docs).toEqual(input.docs);
  });

  it("README.md が読めなければマイルストーンは空", async () => {
    mockedFiles.mockResolvedValue([
      { path: ".research/lab/projects/ddpm/specs/a.md", text: "# spec" },
    ]);
    await post(body());
    expect(mockedMilestones).not.toHaveBeenCalled();
    expect(mockedSkeleton.mock.calls[0][0].milestones).toEqual([]);
  });

  it("読むファイルは先頭から MAX_WORKSPACE_FILES 件まで", async () => {
    const many = Array.from({ length: MAX_WORKSPACE_FILES + 50 }, (_, i) => `f${i}.md`);
    mockedSelect.mockReturnValue(many);
    await post(body());
    expect(mockedFiles.mock.calls[0][2]).toEqual(many.slice(0, MAX_WORKSPACE_FILES));
  });

  it("ANTHROPIC_API_KEY が無ければ AI を飛ばして骨格だけ返す", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(((await res.json()) as MapGenerateResponse).map).toEqual(SKELETON);
    expect(mockedEnrich).not.toHaveBeenCalled();
  });
});

describe("POST /api/map/generate のエラーの変換", () => {
  it("GithubApiError はその status と文言で返す", async () => {
    mockedHead.mockRejectedValue(new GithubApiError("見つかりません", 404));
    const res = await post(body());
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error).toBe("見つかりません");
  });

  it("コミットの取得の GithubApiError も同じ", async () => {
    mockedCommits.mockRejectedValue(new GithubApiError("レート制限", 429));
    const res = await post(body());
    expect(res.status).toBe(429);
    expect(((await res.json()) as ApiError).error).toBe("レート制限");
  });

  it("LlmError は 502", async () => {
    mockedEnrich.mockRejectedValue(new LlmError("AIの回答を読み取れませんでした。"));
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(((await res.json()) as ApiError).error).toBe(
      "AIの回答を読み取れませんでした。",
    );
  });

  it("AI のレート制限は 429", async () => {
    mockedEnrich.mockRejectedValue(
      Object.create(Anthropic.RateLimitError.prototype),
    );
    const res = await post(body());
    expect(res.status).toBe(429);
  });

  it("その他のエラーは 500 で、詳細を返さない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedEnrich.mockRejectedValue(new Error("sk-ant-secret-detail"));
    const res = await post(body());
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("sk-ant-secret-detail");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
