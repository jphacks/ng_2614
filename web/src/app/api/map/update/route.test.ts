import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError, MapUpdateResponse } from "@/lib/api-types";
import { GithubApiError } from "@/lib/github";
import type { MapOp, MapTask, Review, WorkflowMap } from "@/lib/types";
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
    changedPathsSince: vi.fn(),
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
vi.mock("@/lib/map/merge", () => ({
  diffToOps: vi.fn(),
  reviewLinkOps: vi.fn(),
}));

import { fetchCommits } from "@/lib/github";
import { enrichMap, suggestImpactLinks } from "@/lib/llm/map";
import { LlmError } from "@/lib/llm/structured";
import { diffToOps, reviewLinkOps } from "@/lib/map/merge";
import {
  changedPathsSince,
  fetchWorkspaceFiles,
  fetchWorkspaceHead,
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
const mockedChanged = vi.mocked(changedPathsSince);
const mockedFiles = vi.mocked(fetchWorkspaceFiles);
const mockedSelect = vi.mocked(selectWorkspacePaths);
const mockedParseDoc = vi.mocked(parseDoc);
const mockedMilestones = vi.mocked(parseMilestones);
const mockedSkeleton = vi.mocked(buildSkeleton);
const mockedEnrich = vi.mocked(enrichMap);
const mockedImpact = vi.mocked(suggestImpactLinks);
const mockedDiff = vi.mocked(diffToOps);
const mockedReviewLink = vi.mocked(reviewLinkOps);

const BASE = "a".repeat(40);
const HEAD = "c".repeat(40);
const KNOWN_COMMIT = "d".repeat(40);
const NEW_COMMIT = "e".repeat(40);
const README = ".research/lab/projects/ddpm/README.md";
const SPEC = ".research/lab/projects/ddpm/specs/a.md";
const WS = { owner: "me", name: "research-workspace" };

const THEME = {
  name: "拡散モデル",
  question: "ノイズスケジュールで品質は変わるか",
  method: "DDPM",
  evaluation: "FID",
};

function task(id: string, key: string, commitShas: string[] = []): MapTask {
  return {
    id,
    key,
    phaseId: "phase-implement",
    order: 0,
    title: id,
    purpose: "",
    status: "done",
    statusSource: "record",
    sources: [],
    commitShas,
    reviewIds: [],
    origin: "ai",
    review: "unconfirmed",
  };
}

function makeMap(overrides: Partial<WorkflowMap> = {}): WorkflowMap {
  return {
    themeId: "t1",
    workspaceRepo: "me/research-workspace",
    workspaceProject: "ddpm",
    workspaceSha: BASE,
    phases: [],
    milestones: [],
    tasks: [task("wm-1", `commit:${KNOWN_COMMIT}`, [KNOWN_COMMIT])],
    links: [],
    rejected: [],
    appliedReviewIds: [],
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "rv-1",
    themeId: "t1",
    purpose: "目的",
    commitSha: NEW_COMMIT,
    commitMessage: "feat: 新しい実装",
    createdAt: "2026-10-24T00:00:00.000Z",
    findings: [],
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return { theme: THEME, repo: "me/impl", map: makeMap(), ...overrides };
}

function post(payload: unknown, raw = false): Promise<Response> {
  return POST(
    new Request("http://localhost:3000/api/map/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (payload as string) : JSON.stringify(payload),
    }),
  );
}

function commit(sha: string) {
  return {
    sha,
    message: `feat: ${sha.slice(0, 4)}`,
    author: "me",
    date: "2026-10-24T00:00:00Z",
    url: `https://github.com/me/impl/commit/${sha}`,
  };
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

const NEW_TASK = task("wm-new", `commit:${NEW_COMMIT}`, [NEW_COMMIT]);
const PARTIAL = {
  themeId: "t1",
  tasks: [NEW_TASK, task("wm-1", `commit:${KNOWN_COMMIT}`, [KNOWN_COMMIT])],
} as unknown as WorkflowMap;
const ENRICHED = {
  themeId: "t1",
  tasks: [NEW_TASK, task("wm-1", `commit:${KNOWN_COMMIT}`, [KNOWN_COMMIT])],
  enriched: true,
} as unknown as WorkflowMap;

function addTaskOp(commitShas: string[]): MapOp {
  return {
    op: "add_task",
    tempId: "wm-new",
    phaseId: "phase-implement",
    title: "新しい実装",
    purpose: "",
    status: "done",
    statusSource: "record",
    sources: [],
    commitShas,
    reviewIds: [],
    reason: "実装リポジトリに新しいコミットが増えた",
  };
}

const originalKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-ant-dummy-for-tests";
  mockedHead.mockResolvedValue(HEAD);
  mockedChanged.mockResolvedValue([README, SPEC]);
  mockedSelect.mockReturnValue([README, SPEC]);
  // 渡されたパスのファイルだけを返す（隣のドキュメントを読む2回目の呼び出しで、余分なファイルを返さない）
  mockedFiles.mockImplementation(async (_repo, _sha, paths) =>
    [
      { path: README, text: "# README\n- [ ] M1" },
      { path: SPEC, text: "# spec" },
    ].filter((f) => paths.includes(f.path)),
  );
  mockedParseDoc.mockImplementation((file) =>
    file.path === README ? undefined : doc(file.path),
  );
  mockedMilestones.mockReturnValue([{ title: "M1", done: false }]);
  mockedCommits.mockResolvedValue({
    commits: [commit(NEW_COMMIT), commit(KNOWN_COMMIT)],
  });
  mockedSkeleton.mockReturnValue(PARTIAL);
  mockedEnrich.mockResolvedValue(ENRICHED);
  mockedDiff.mockImplementation(() => [addTaskOp([NEW_COMMIT])]);
  mockedReviewLink.mockReturnValue([]);
  mockedImpact.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
});

describe("POST /api/map/update の入力の検証", () => {
  it("JSON でない本文は 400", async () => {
    const res = await post("{not json", true);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toContain("JSON");
  });

  it("map が無ければ 400", async () => {
    const res = await post({ theme: THEME, repo: "me/impl" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toContain("map");
  });

  it("map の tasks の形が違えば 400", async () => {
    const res = await post(body({ map: { ...makeMap(), tasks: [{ id: 1 }] } }));
    expect(res.status).toBe(400);
    expect(mockedHead).not.toHaveBeenCalled();
  });

  it.each([
    ["workspaceRepo", { workspaceRepo: undefined }],
    ["workspaceProject", { workspaceProject: undefined }],
    ["workspaceSha", { workspaceSha: undefined }],
  ])("map に %s が無ければ 400", async (_, overrides) => {
    const res = await post(body({ map: makeMap(overrides) }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).toBeTruthy();
    expect(mockedHead).not.toHaveBeenCalled();
  });

  it.each([
    ["repo が owner/name でない", { repo: "nope" }],
    [
      "workspaceRepo が owner/name でない",
      { map: makeMap({ workspaceRepo: "a/b/c" }) },
    ],
    ["workspaceSha が16進数でない", { map: makeMap({ workspaceSha: "../x" }) }],
    [
      "プロジェクト名にスラッシュがある",
      { map: makeMap({ workspaceProject: "a/b" }) },
    ],
  ])("%s ときは GitHub を呼ばずに 400", async (_, overrides) => {
    const res = await post(body(overrides));
    expect(res.status).toBe(400);
    expect(mockedHead).not.toHaveBeenCalled();
    expect(mockedCommits).not.toHaveBeenCalled();
  });
});

describe("POST /api/map/update の流れ", () => {
  it("変わったファイルだけを読み、部分的なマップを AI で補って、差分の op と今回の SHA を返す", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    const json = (await res.json()) as MapUpdateResponse;
    expect(json.workspaceSha).toBe(HEAD);
    expect(json.ops).toEqual([addTaskOp([NEW_COMMIT])]);

    expect(mockedHead).toHaveBeenCalledWith(WS);
    expect(mockedChanged).toHaveBeenCalledWith(WS, BASE, HEAD);
    expect(mockedSelect).toHaveBeenCalledWith([README, SPEC], "ddpm");
    expect(mockedFiles).toHaveBeenCalledWith(WS, HEAD, [README, SPEC]);

    const input = mockedSkeleton.mock.calls[0][0];
    expect(input).toMatchObject({
      themeId: "t1",
      workspaceRepo: "me/research-workspace",
      workspaceProject: "ddpm",
      workspaceSha: HEAD,
      milestones: [{ title: "M1", done: false }],
    });
    expect(input.docs.map((d) => d.path)).toEqual([SPEC]);

    expect(mockedEnrich).toHaveBeenCalledTimes(1);
    expect(mockedEnrich.mock.calls[0][0].map).toEqual(PARTIAL);
    expect(mockedDiff).toHaveBeenCalledTimes(1);
    expect(mockedDiff.mock.calls[0][0]).toMatchObject({ themeId: "t1" });
    expect(mockedDiff.mock.calls[0][1]).toBe(ENRICHED);
    // 判定が無いので、判定に関する処理はしない
    expect(mockedReviewLink).not.toHaveBeenCalled();
    expect(mockedImpact).not.toHaveBeenCalled();
  });

  it("SHA が前回と同じなら、変わったファイルは無いとして compare を呼ばない", async () => {
    mockedHead.mockResolvedValue(BASE);
    mockedSelect.mockReturnValue([]);
    mockedFiles.mockResolvedValue([]);
    mockedSkeleton.mockReturnValue({ themeId: "t1", tasks: [] } as unknown as WorkflowMap);
    mockedDiff.mockReturnValue([]);
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(((await res.json()) as MapUpdateResponse)).toEqual({
      ops: [],
      workspaceSha: BASE,
    });
    expect(mockedChanged).not.toHaveBeenCalled();
    expect(mockedSelect).toHaveBeenCalledWith([], "ddpm");
    // 何も変わっていないので、AI は呼ばない
    expect(mockedEnrich).not.toHaveBeenCalled();
  });

  it("マップにまだ無い実装のコミットだけを骨格に渡す", async () => {
    await post(body());
    const shas = mockedSkeleton.mock.calls[0][0].commits.map((c) => c.sha);
    expect(shas).toEqual([NEW_COMMIT]);
    expect(mockedSkeleton.mock.calls[0][0].commits[0]).toEqual({
      sha: NEW_COMMIT,
      message: `feat: ${NEW_COMMIT.slice(0, 4)}`,
      url: `https://github.com/me/impl/commit/${NEW_COMMIT}`,
      date: "2026-10-24T00:00:00Z",
    });
  });

  it("判定のコミットは、マップにすでにあっても渡す", async () => {
    await post(body({ review: makeReview({ commitSha: KNOWN_COMMIT }) }));
    const shas = mockedSkeleton.mock.calls[0][0].commits.map((c) => c.sha);
    expect(shas.sort()).toEqual([KNOWN_COMMIT, NEW_COMMIT].sort());
  });

  it("README.md が変わっていなければ、マイルストーンは空", async () => {
    mockedFiles.mockResolvedValue([{ path: SPEC, text: "# spec" }]);
    await post(body());
    expect(mockedMilestones).not.toHaveBeenCalled();
    expect(mockedSkeleton.mock.calls[0][0].milestones).toEqual([]);
  });

  it("ANTHROPIC_API_KEY が無ければ、AI を飛ばして骨格のまま差分を取る", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post(body({ review: makeReview() }));
    expect(res.status).toBe(200);
    expect(mockedEnrich).not.toHaveBeenCalled();
    expect(mockedImpact).not.toHaveBeenCalled();
    expect(mockedDiff.mock.calls[0][1]).toEqual(PARTIAL);
    // 判定のコミットのタスクへの結び付けは AI を使わないので残る
    expect(mockedReviewLink).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/map/update の判定の取り込み", () => {
  it("reviewLinkOps の op と、影響の矢印の op を足す", async () => {
    const linkOp: MapOp = {
      op: "link_task",
      taskId: "wm-1",
      reviewIds: ["rv-1"],
      reason: "判定を結び付けた",
    };
    const impactOp: MapOp = {
      op: "add_link",
      fromTaskId: "wm-new",
      toTaskId: "wm-spec",
      kind: "impact",
      findingId: "f1",
      reason: "影響",
    };
    mockedReviewLink.mockReturnValue([linkOp]);
    mockedImpact.mockResolvedValue([impactOp]);
    const review = makeReview();

    const res = await post(body({ review }));
    const json = (await res.json()) as MapUpdateResponse;
    expect(json.ops.slice(-2)).toEqual([linkOp, impactOp]);

    expect(mockedReviewLink.mock.calls[0][0]).toMatchObject({
      workspaceSha: BASE,
    });
    expect(mockedReviewLink.mock.calls[0][1]).toMatchObject({ id: "rv-1" });

    // 影響の矢印の選び先は、req.map に新しいタスクを足したもの
    const impactInput = mockedImpact.mock.calls[0][0];
    expect(impactInput.theme).toEqual(THEME);
    expect(impactInput.review).toMatchObject({ id: "rv-1" });
    expect(impactInput.map.tasks.map((t) => t.id)).toEqual(["wm-1", "wm-new"]);
    expect(impactInput.map.workspaceSha).toBe(BASE);
  });

  it("判定のコミットが今回加わるタスクには、判定の id も付ける", async () => {
    const res = await post(body({ review: makeReview() }));
    const add = ((await res.json()) as MapUpdateResponse).ops[0];
    expect(add).toMatchObject({ op: "add_task", reviewIds: ["rv-1"] });
  });

  it("フックの判定（commitSha が空）では、add_task に判定の id を付けない", async () => {
    mockedDiff.mockImplementation(() => [addTaskOp([NEW_COMMIT])]);
    const res = await post(body({ review: makeReview({ commitSha: "" }) }));
    const add = ((await res.json()) as MapUpdateResponse).ops[0];
    expect(add).toMatchObject({ op: "add_task", reviewIds: [] });
  });
});

describe("POST /api/map/update のエラーの変換", () => {
  it("GithubApiError はその status と文言で返す", async () => {
    mockedChanged.mockRejectedValue(new GithubApiError("見つかりません", 404));
    const res = await post(body());
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error).toBe("見つかりません");
  });

  it("LlmError は 502", async () => {
    mockedEnrich.mockRejectedValue(new LlmError("AIが回答を拒否しました。"));
    const res = await post(body());
    expect(res.status).toBe(502);
    expect(((await res.json()) as ApiError).error).toBe("AIが回答を拒否しました。");
  });

  it("影響の矢印を選ぶときの AI のレート制限は 429", async () => {
    mockedImpact.mockRejectedValue(
      Object.create(Anthropic.RateLimitError.prototype),
    );
    const res = await post(body({ review: makeReview() }));
    expect(res.status).toBe(429);
  });

  it("その他のエラーは 500 で、詳細を返さない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedDiff.mockImplementation(() => {
      throw new Error("sk-ant-secret-detail");
    });
    const res = await post(body());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("sk-ant-secret-detail");
  });
});

describe("POST /api/map/update の隣のドキュメント", () => {
  const BRAINSTORM = ".research/secretary/notes/brainstorm/2026-10-20-x.md";

  it("変わった spec がリンクしている、マップに既にある壁打ちも読み、その目的は今のマップのものを引き継ぐ", async () => {
    mockedParseDoc.mockImplementation((file) => {
      if (file.path === README) return undefined;
      return file.path === SPEC ? { ...doc(SPEC), links: [BRAINSTORM] } : doc(file.path);
    });
    mockedFiles.mockImplementation(async (_repo, _sha, paths) =>
      paths.map((path) => ({ path, text: "# x" })),
    );
    const known = { ...task("wm-b", BRAINSTORM, []), purpose: "人が確かめた目的" };
    const map = makeMap({ tasks: [...makeMap().tasks, known] });
    mockedSkeleton.mockReturnValue({
      ...PARTIAL,
      tasks: [{ ...task("wm-b", BRAINSTORM, []), purpose: "" }],
    } as WorkflowMap);

    const res = await post(body({ map }));
    expect(res.status).toBe(200);
    expect(mockedFiles).toHaveBeenLastCalledWith(WS, HEAD, [BRAINSTORM]);
    const input = mockedSkeleton.mock.calls[0][0];
    expect(input.docs.map((d) => d.path)).toEqual([SPEC, BRAINSTORM]);
    // AI に渡す前に、隣の目的を今のマップのものにしてある
    expect(mockedEnrich.mock.calls[0][0].map.tasks[0].purpose).toBe("人が確かめた目的");
  });

  it("リンク先がマップに無ければ、隣としては読まない", async () => {
    mockedParseDoc.mockImplementation((file) =>
      file.path === README ? undefined : { ...doc(file.path), links: [BRAINSTORM] },
    );
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(mockedFiles).toHaveBeenLastCalledWith(WS, HEAD, []);
  });
});
