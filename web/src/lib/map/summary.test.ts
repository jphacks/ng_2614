import { describe, expect, it } from "vitest";
import type { MapPhase, MapTask, WorkflowMap } from "@/lib/types";
import {
  changedParentIds,
  focusTasks,
  isMapPage,
  phaseSummaries,
  themeIdFromPath,
} from "./summary";

function task(id: string, overrides: Partial<MapTask> = {}): MapTask {
  return {
    id,
    phaseId: "p1",
    order: 0,
    title: id,
    purpose: "",
    status: "todo",
    statusSource: "record",
    sources: [],
    commitShas: [],
    reviewIds: [],
    origin: "ai",
    review: "confirmed",
    ...overrides,
  };
}

const PHASES: MapPhase[] = [
  { id: "p2", name: "実装", order: 1, kinds: [] },
  { id: "p1", name: "調査", order: 0, kinds: [] },
  { id: "p3", name: "検証", order: 2, kinds: [] },
];

function mapOf(tasks: MapTask[], changedTaskIds?: string[]): WorkflowMap {
  return {
    themeId: "theme",
    phases: PHASES,
    milestones: [],
    tasks,
    links: [],
    rejected: [],
    appliedReviewIds: [],
    lastUpdate: changedTaskIds && {
      reviewId: "r1",
      at: "2026-10-24T00:00:00.000Z",
      summaries: [],
      changedTaskIds,
    },
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
  };
}

describe("phaseSummaries", () => {
  it("レーンの order 順に、親を持たないタスクだけを数える", () => {
    const map = mapOf([
      task("a", { phaseId: "p2", status: "done" }),
      task("b", { phaseId: "p1", status: "doing" }),
      task("b1", { phaseId: "p1", parentId: "b", status: "todo" }),
    ]);
    const result = phaseSummaries(map);
    expect(result.map((s) => s.phase.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.map((s) => s.total)).toEqual([1, 1, 0]);
  });

  it("0 の状態も含めて数え、effectiveStatus（サブタスクから決まる状態）で数える", () => {
    const map = mapOf([
      task("a", { status: "todo" }),
      task("a1", { parentId: "a", status: "done" }),
      task("a2", { parentId: "a", status: "doing" }),
      task("b", { status: "waiting" }),
      task("c", { status: "rejected", rejectReason: "x" }),
    ]);
    const [first, , last] = phaseSummaries(map);
    expect(first.counts).toEqual({ todo: 0, doing: 1, waiting: 1, done: 0, rejected: 1 });
    expect(last.counts).toEqual({ todo: 0, doing: 0, waiting: 0, done: 0, rejected: 0 });
  });

  it("focus はそのレーンの今ここだけを order 順に持つ", () => {
    const map = mapOf([
      task("b", { order: 1, status: "waiting" }),
      task("a", { order: 0, status: "doing" }),
      task("c", { order: 2, status: "done" }),
      task("d", { phaseId: "p2", status: "doing" }),
    ]);
    const [first, second] = phaseSummaries(map);
    expect(first.focus.map((t) => t.id)).toEqual(["a", "b"]);
    expect(second.focus.map((t) => t.id)).toEqual(["d"]);
  });

  it("レーンが無ければ空", () => {
    expect(phaseSummaries({ ...mapOf([]), phases: [] })).toEqual([]);
  });
});

describe("focusTasks", () => {
  it("doing と waiting の親タスクだけを、レーン順・タスク順に返す", () => {
    const map = mapOf([
      task("impl", { phaseId: "p2", status: "doing" }),
      task("r2", { order: 1, status: "waiting" }),
      task("r1", { order: 0, status: "doing" }),
      task("todo", { status: "todo" }),
      task("done", { status: "done" }),
      task("rej", { status: "rejected", rejectReason: "x" }),
    ]);
    expect(focusTasks(map).map((t) => t.id)).toEqual(["r1", "r2", "impl"]);
  });

  it("サブタスクは含めず、サブタスクの状態から決まる親の状態で判定する", () => {
    const map = mapOf([
      task("a", { status: "todo" }),
      task("a1", { parentId: "a", status: "doing" }),
      task("b", { status: "doing" }),
      task("b1", { parentId: "b", status: "done" }),
    ]);
    expect(focusTasks(map).map((t) => t.id)).toEqual(["a"]);
  });

  it("手で決めた状態（manual）はサブタスクより優先する", () => {
    const map = mapOf([
      task("a", { status: "done", statusSource: "manual" }),
      task("a1", { parentId: "a", status: "doing" }),
    ]);
    expect(focusTasks(map)).toEqual([]);
  });
});

describe("changedParentIds", () => {
  it("lastUpdate が無ければ空", () => {
    expect(changedParentIds(mapOf([task("a")]))).toEqual([]);
  });

  it("サブタスクは親の id にし、重複を除いて最初に出た順で返す", () => {
    const map = mapOf(
      [task("a"), task("a1", { parentId: "a" }), task("a2", { parentId: "a" }), task("b")],
      ["b", "a1", "a", "a2"],
    );
    expect(changedParentIds(map)).toEqual(["b", "a"]);
  });

  it("無くなったタスクと、親が無くなったサブタスクは除く", () => {
    const map = mapOf([task("a"), task("x1", { parentId: "gone" })], ["gone", "x1", "a"]);
    expect(changedParentIds(map)).toEqual(["a"]);
  });
});

describe("themeIdFromPath", () => {
  const lookup = (id: string) => (id === "r1" ? "t1" : undefined);

  it("/themes/[themeId] とその下は themeId を返す", () => {
    expect(themeIdFromPath("/themes/t1", lookup)).toBe("t1");
    expect(themeIdFromPath("/themes/t1/", lookup)).toBe("t1");
    expect(themeIdFromPath("/themes/t1/reviews/new", lookup)).toBe("t1");
    expect(themeIdFromPath("/themes/t1/map", lookup)).toBe("t1");
  });

  it("id は decodeURIComponent する。壊れたエンコードはそのまま", () => {
    expect(themeIdFromPath("/themes/%E7%A0%94%E7%A9%B6", lookup)).toBe("研究");
    expect(themeIdFromPath("/themes/100%", lookup)).toBe("100%");
  });

  it("/reviews/[reviewId] は reviewThemeId の結果を返す（デコード後の id で呼ぶ）", () => {
    expect(themeIdFromPath("/reviews/r1", lookup)).toBe("t1");
    expect(themeIdFromPath("/reviews/unknown", lookup)).toBeUndefined();
    const seen: string[] = [];
    themeIdFromPath("/reviews/a%20b", (id) => {
      seen.push(id);
      return undefined;
    });
    expect(seen).toEqual(["a b"]);
  });

  it("それ以外は undefined", () => {
    expect(themeIdFromPath("/", lookup)).toBeUndefined();
    expect(themeIdFromPath("", lookup)).toBeUndefined();
    expect(themeIdFromPath("/themes", lookup)).toBeUndefined();
    expect(themeIdFromPath("/themes/", lookup)).toBeUndefined();
    expect(themeIdFromPath("/reviews", lookup)).toBeUndefined();
    expect(themeIdFromPath("/settings/t1", lookup)).toBeUndefined();
  });
});

describe("isMapPage", () => {
  it("/themes/[themeId]/map だけ true", () => {
    expect(isMapPage("/themes/t1/map")).toBe(true);
    expect(isMapPage("/themes/t1/map/")).toBe(true);
  });

  it("それ以外は false", () => {
    expect(isMapPage("/themes/t1")).toBe(false);
    expect(isMapPage("/themes/t1/reviews/new")).toBe(false);
    expect(isMapPage("/themes/map")).toBe(false);
    expect(isMapPage("/reviews/map/map")).toBe(false);
    expect(isMapPage("/")).toBe(false);
  });
});
