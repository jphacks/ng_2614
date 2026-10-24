import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MapGenerateRequest,
  MapGenerateResponse,
  MapUpdateRequest,
} from "@/lib/api-types";
import type { MapTask, ResearchTheme, Review, WorkflowMap } from "@/lib/types";

// api-client と storage は、メモリ上の代わりに差し替える
const mocks = vi.hoisted(() => ({
  maps: new Map<string, unknown>(),
  themes: new Map<string, unknown>(),
  reviews: new Map<string, unknown>(),
  postMapUpdate: vi.fn(),
  postMapGenerate: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  postMapUpdate: mocks.postMapUpdate,
  postMapGenerate: mocks.postMapGenerate,
}));

vi.mock("@/lib/storage", () => ({
  MAPS_CHANGED_EVENT: "rc:maps-changed",
  nowIso: () => "2026-10-24T12:00:00.000Z",
  getWorkflowMap: (themeId: string) => {
    const m = mocks.maps.get(themeId);
    return m ? structuredClone(m) : undefined;
  },
  saveWorkflowMap: (map: WorkflowMap) => {
    mocks.maps.set(map.themeId, structuredClone(map));
    return map;
  },
  getTheme: (id: string) => mocks.themes.get(id),
  getReview: (id: string) => mocks.reviews.get(id),
}));

import {
  generateOrRegenerate,
  getMapUpdateStatus,
  refreshFromWorkspace,
  startMapUpdate,
} from "./auto-update";

const NOW = "2026-10-24T10:00:00.000Z";

const theme: ResearchTheme = {
  id: "theme",
  name: "名前",
  repo: "owner/repo",
  question: "問い",
  method: "手法",
  evaluation: "評価",
  updatedAt: NOW,
};

function task(id: string, overrides: Partial<MapTask> = {}): MapTask {
  return {
    id,
    phaseId: "p1",
    order: 0,
    title: `タスク ${id}`,
    purpose: "目的",
    status: "todo",
    statusSource: "record",
    sources: [],
    commitShas: [],
    reviewIds: [],
    origin: "ai",
    review: "unconfirmed",
    ...overrides,
  };
}

function mapOf(overrides: Partial<WorkflowMap> = {}): WorkflowMap {
  return {
    themeId: "theme",
    phases: [{ id: "p1", name: "調査", order: 0, kinds: ["brainstorm"] }],
    milestones: [],
    tasks: [task("a", { key: "doc/a.md" })],
    links: [],
    rejected: [],
    appliedReviewIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function reviewOf(id: string): Review {
  return {
    id,
    themeId: "theme",
    purpose: "目的",
    commitSha: "abc",
    commitMessage: "m",
    createdAt: NOW,
    findings: [],
  };
}

function stored(): WorkflowMap {
  return mocks.maps.get("theme") as WorkflowMap;
}

const doneOp = {
  op: "update_task" as const,
  taskId: "a",
  status: "done" as const,
  statusSource: "record" as const,
  reason: "a を完了にした",
};

beforeEach(() => {
  mocks.maps.clear();
  mocks.themes.clear();
  mocks.reviews.clear();
  mocks.postMapUpdate.mockReset();
  mocks.postMapGenerate.mockReset();
  mocks.themes.set("theme", theme);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

// startMapUpdate は待たずに戻るので、状態が running を抜けるまで待つ
async function settled(reviewId: string) {
  await vi.waitFor(() => expect(getMapUpdateStatus(reviewId).state).not.toBe("running"));
  return getMapUpdateStatus(reviewId);
}

describe("startMapUpdate", () => {
  it("running になり、変更を当てはめて保存し、done に summaries と canUndo を入れる", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockResolvedValue({ ops: [doneOp], workspaceSha: "sha1" });
    const review = reviewOf("rev-1");

    startMapUpdate(review);
    expect(getMapUpdateStatus("rev-1")).toEqual({ state: "running" });
    const status = await settled("rev-1");

    expect(status).toEqual({ state: "done", summaries: ["a を完了にした"], canUndo: true });
    expect(stored().tasks[0].status).toBe("done");
    expect(stored().appliedReviewIds).toContain("rev-1");
    expect(stored().workspaceSha).toBe("sha1");
    const req = mocks.postMapUpdate.mock.calls[0][0] as MapUpdateRequest;
    expect(req.repo).toBe("owner/repo");
    expect(req.review?.id).toBe("rev-1");
    expect(req.theme).toEqual({ name: "名前", question: "問い", method: "手法", evaluation: "評価" });
  });

  it("同じ判定では2回走らない（実行中も、済んだあとも）", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockResolvedValue({ ops: [doneOp] });
    const review = reviewOf("rev-2");

    startMapUpdate(review);
    startMapUpdate(review); // React の開発モードの二重呼び出し
    await settled("rev-2");
    startMapUpdate(review);
    await settled("rev-2");

    expect(mocks.postMapUpdate).toHaveBeenCalledTimes(1);
  });

  it("マップが無い・テーマが無いときは何もしない", () => {
    startMapUpdate(reviewOf("rev-3"));
    mocks.maps.set("theme", mapOf());
    mocks.themes.clear();
    startMapUpdate(reviewOf("rev-3"));
    expect(mocks.postMapUpdate).not.toHaveBeenCalled();
    expect(getMapUpdateStatus("rev-3")).toEqual({ state: "none" });
  });

  it("ops が空なら、appliedReviewIds と workspaceSha だけ更新する", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockResolvedValue({ ops: [], workspaceSha: "sha2" });
    startMapUpdate(reviewOf("rev-4"));
    const status = await settled("rev-4");

    expect(status).toEqual({ state: "done", summaries: [], canUndo: false });
    expect(stored().appliedReviewIds).toEqual(["rev-4"]);
    expect(stored().workspaceSha).toBe("sha2");
    expect(stored().previous).toBeUndefined();
  });

  it("失敗したら error になり、もう一度呼べば再実行する", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockRejectedValueOnce(new Error("接続できません"));
    startMapUpdate(reviewOf("rev-5"));
    expect(await settled("rev-5")).toEqual({ state: "error", message: "接続できません" });
    expect(stored().appliedReviewIds).toEqual([]);

    mocks.postMapUpdate.mockResolvedValueOnce({ ops: [doneOp] });
    startMapUpdate(reviewOf("rev-5"));
    expect((await settled("rev-5")).state).toBe("done");
    expect(mocks.postMapUpdate).toHaveBeenCalledTimes(2);
  });

  it("待っている間に直された分は、読み直してから当てはめるので消えない", async () => {
    mocks.maps.set("theme", mapOf({ tasks: [task("a", { key: "doc/a.md" }), task("b")] }));
    mocks.postMapUpdate.mockImplementation(async () => {
      // 待っている間に、人が b の題を直した
      const m = structuredClone(stored());
      m.tasks = m.tasks.map((t) => (t.id === "b" ? { ...t, title: "人が直した題" } : t));
      mocks.maps.set("theme", m);
      return { ops: [doneOp] };
    });
    startMapUpdate(reviewOf("rev-6"));
    await settled("rev-6");
    expect(stored().tasks.find((t) => t.id === "b")?.title).toBe("人が直した題");
    expect(stored().tasks.find((t) => t.id === "a")?.status).toBe("done");
  });

  it("待っている間にマップが消されたら、保存し直さない", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockImplementation(async () => {
      mocks.maps.delete("theme");
      return { ops: [doneOp] };
    });
    startMapUpdate(reviewOf("rev-7"));
    await vi.waitFor(() => expect(getMapUpdateStatus("rev-7").state).toBe("none"));
    expect(mocks.maps.has("theme")).toBe(false);
  });
});

describe("getMapUpdateStatus（保存されたマップから決める）", () => {
  it("適用済みで lastUpdate が合えば done、取り消したあとは canUndo が false", () => {
    mocks.reviews.set("rev-8", reviewOf("rev-8"));
    expect(getMapUpdateStatus("rev-8")).toEqual({ state: "none" });

    mocks.maps.set(
      "theme",
      mapOf({
        appliedReviewIds: ["rev-8"],
        lastUpdate: { reviewId: "rev-8", at: NOW, summaries: ["x"], changedTaskIds: [] },
        previous: { ...mapOf() },
      }),
    );
    const done = getMapUpdateStatus("rev-8");
    expect(done).toEqual({ state: "done", summaries: ["x"], canUndo: true });
    // 内容が同じ間は同じ参照（useSyncExternalStore が繰り返し呼んでも止まらない）
    expect(getMapUpdateStatus("rev-8")).toBe(done);

    const undone = structuredClone(stored());
    delete undone.previous;
    delete undone.lastUpdate;
    mocks.maps.set("theme", undone);
    expect(getMapUpdateStatus("rev-8")).toEqual({ state: "done", summaries: [], canUndo: false });
  });
});

describe("refreshFromWorkspace", () => {
  it("review なしで更新を呼び、反映した件数を返す。appliedReviewIds に代わりの id を残さない", async () => {
    mocks.maps.set("theme", mapOf({ appliedReviewIds: ["r0"] }));
    mocks.postMapUpdate.mockResolvedValue({ ops: [doneOp], workspaceSha: "sha3" });

    const count = await refreshFromWorkspace(theme);

    expect(count).toBe(1);
    const req = mocks.postMapUpdate.mock.calls[0][0] as MapUpdateRequest;
    expect(req.review).toBeUndefined();
    expect(req.repo).toBe("owner/repo");
    expect(stored().tasks[0].status).toBe("done");
    expect(stored().appliedReviewIds).toEqual(["r0"]);
    expect(stored().workspaceSha).toBe("sha3");
    expect(stored().previous).toBeDefined(); // 取り消せる
  });

  it("変更が無ければ 0 を返し、workspaceSha は更新する", async () => {
    mocks.maps.set("theme", mapOf());
    mocks.postMapUpdate.mockResolvedValue({ ops: [], workspaceSha: "sha4" });
    expect(await refreshFromWorkspace(theme)).toBe(0);
    expect(stored().workspaceSha).toBe("sha4");
    expect(stored().appliedReviewIds).toEqual([]);
  });

  it("マップが無ければ Error", async () => {
    await expect(refreshFromWorkspace(theme)).rejects.toThrow("マップ");
    expect(mocks.postMapUpdate).not.toHaveBeenCalled();
  });
});

describe("generateOrRegenerate", () => {
  function freshMap(): WorkflowMap {
    return mapOf({
      workspaceSha: "fresh-sha",
      milestones: [{ id: "ms-1", title: "中間発表", done: false }],
      tasks: [
        task("fa", { key: "doc/a.md", title: "ワークスペースの題", status: "doing" }),
        task("fn", { key: "doc/n.md", title: "新しいタスク", milestoneId: "ms-1" }),
      ],
    });
  }

  it("マップが無ければ、そのまま保存して workspaceRepo・workspaceProject を入れる", async () => {
    mocks.postMapGenerate.mockResolvedValue({ map: freshMap() } satisfies MapGenerateResponse);
    const saved = await generateOrRegenerate(theme, {
      workspaceRepo: "owner/ws",
      workspaceProject: "proj",
    });
    expect(saved.tasks).toHaveLength(2);
    expect(stored().workspaceRepo).toBe("owner/ws");
    expect(stored().workspaceProject).toBe("proj");
    const req = mocks.postMapGenerate.mock.calls[0][0] as MapGenerateRequest;
    expect(req).toMatchObject({ themeId: "theme", repo: "owner/repo", workspaceRepo: "owner/ws" });
  });

  it("マップがあれば差分を当てはめ、人の手直しを守る。引数が無ければ保存されたマップの workspace を使う", async () => {
    mocks.maps.set(
      "theme",
      mapOf({
        workspaceRepo: "owner/old-ws",
        workspaceProject: "old-proj",
        tasks: [
          task("a", { key: "doc/a.md", title: "人が直した題", review: "edited", status: "todo" }),
          task("h", { origin: "human", review: "edited", statusSource: "manual" }),
        ],
      }),
    );
    mocks.postMapGenerate.mockResolvedValue({ map: freshMap() });

    const saved = await generateOrRegenerate(theme, {});

    const req = mocks.postMapGenerate.mock.calls[0][0] as MapGenerateRequest;
    expect(req.workspaceRepo).toBe("owner/old-ws");
    expect(req.workspaceProject).toBe("old-proj");
    expect(saved.workspaceRepo).toBe("owner/old-ws");
    // 人が直したタスクは文言も状態も変えない。人が足したタスクは残る
    const a = saved.tasks.find((t) => t.id === "a")!;
    expect(a).toMatchObject({ title: "人が直した題", status: "todo" });
    expect(saved.tasks.some((t) => t.id === "h")).toBe(true);
    // 新しいタスクが足され、マイルストーンも入る
    const added = saved.tasks.find((t) => t.key === "doc/n.md");
    expect(added).toMatchObject({ title: "新しいタスク", milestoneId: "ms-1" });
    expect(saved.milestones.map((m) => m.id)).toEqual(["ms-1"]);
    expect(saved.workspaceSha).toBe("fresh-sha");
    // 代わりの id は残らず、取り消せる
    expect(saved.appliedReviewIds).toEqual([]);
    expect(saved.previous).toBeDefined();
    expect(stored()).toEqual(saved);
  });

  it("同じ fresh をもう一度当てても、タスクは増えない", async () => {
    mocks.maps.set("theme", mapOf({ tasks: [] }));
    mocks.postMapGenerate.mockImplementation(async () => ({ map: freshMap() }));
    const first = await generateOrRegenerate(theme, {});
    const second = await generateOrRegenerate(theme, {});
    expect(first.tasks).toHaveLength(2);
    expect(second.tasks).toHaveLength(2);
  });
});
