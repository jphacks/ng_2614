import { describe, expect, it } from "vitest";
import type { MapTask, WorkflowMap } from "@/lib/types";
import {
  addPhase,
  addTask,
  clearManualStatus,
  confirmTask,
  deletePhase,
  deleteTask,
  editTaskText,
  movePhase,
  renamePhase,
  restoreRejected,
  setTaskStatus,
} from "./edit";

const NOW = "2026-10-24T12:00:00.000Z";

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

function baseMap(overrides: Partial<WorkflowMap> = {}): WorkflowMap {
  return {
    themeId: "theme",
    phases: [
      { id: "p1", name: "調査", order: 0, kinds: [] },
      { id: "p2", name: "実装", order: 1, kinds: [] },
      { id: "p3", name: "発表", order: 2, kinds: [] },
    ],
    milestones: [],
    tasks: [task("a"), task("a1", { parentId: "a", order: 0 }), task("b", { phaseId: "p2" })],
    links: [],
    rejected: [],
    appliedReviewIds: [],
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
    ...overrides,
  };
}

function find(map: WorkflowMap, id: string): MapTask {
  const found = map.tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no task ${id}`);
  return found;
}

describe("editTaskText", () => {
  it("値が変わったときだけ edited にし、updatedAt を now にする", () => {
    const map = baseMap();
    const changed = editTaskText(map, "a", { title: " 新題 " }, NOW);
    expect(find(changed, "a")).toMatchObject({ title: "新題", purpose: "目的", review: "edited" });
    expect(changed.updatedAt).toBe(NOW);
    expect(find(map, "a").title).toBe("タスク a");
  });

  it("同じ値や空のタイトルでは何も変えず、review も変えない", () => {
    const map = baseMap();
    expect(editTaskText(map, "a", { title: "タスク a", purpose: "目的" }, NOW)).toBe(map);
    expect(editTaskText(map, "a", { title: "  " }, NOW)).toBe(map);
    expect(editTaskText(map, "none", { title: "x" }, NOW)).toBe(map);
  });

  it("目的は空にもできる", () => {
    expect(find(editTaskText(baseMap(), "a", { purpose: "" }, NOW), "a").purpose).toBe("");
  });
});

describe("setTaskStatus / clearManualStatus / confirmTask", () => {
  it("状態を変えて manual にする。rejected 以外では rejectReason を消す", () => {
    const rejected = setTaskStatus(baseMap(), "a", "rejected", " 合わない ", NOW);
    expect(find(rejected, "a")).toMatchObject({
      status: "rejected",
      statusSource: "manual",
      rejectReason: "合わない",
    });
    const back = setTaskStatus(rejected, "a", "doing", "残らない", NOW);
    expect(find(back, "a")).toMatchObject({ status: "doing", statusSource: "manual" });
    expect(find(back, "a").rejectReason).toBeUndefined();
  });

  it("rejected にするのに理由が無い・空白だけなら Error", () => {
    expect(() => setTaskStatus(baseMap(), "a", "rejected", undefined, NOW)).toThrow();
    expect(() => setTaskStatus(baseMap(), "a", "rejected", "   ", NOW)).toThrow();
  });

  it("clearManualStatus は manual のときだけ record に戻す", () => {
    const manual = setTaskStatus(baseMap(), "a", "done", undefined, NOW);
    const cleared = clearManualStatus(manual, "a", NOW);
    expect(find(cleared, "a")).toMatchObject({ statusSource: "record", status: "done" });
    expect(clearManualStatus(cleared, "a", NOW)).toBe(cleared);
  });

  it("confirmTask は unconfirmed のときだけ confirmed にする", () => {
    const map = baseMap({ tasks: [task("a"), task("b", { review: "edited" })] });
    expect(find(confirmTask(map, "a", NOW), "a").review).toBe("confirmed");
    expect(confirmTask(map, "b", NOW)).toBe(map);
  });
});

describe("deleteTask / restoreRejected", () => {
  const links = [
    { id: "l1", fromTaskId: "a", toTaskId: "b", kind: "flow" as const },
    { id: "l2", fromTaskId: "a1", toTaskId: "b", kind: "impact" as const },
    { id: "l3", fromTaskId: "b", toTaskId: "c", kind: "flow" as const },
  ];

  it("タスクとサブタスクとつながるリンクを消し、却下の一覧に残す", () => {
    const map = baseMap({
      tasks: [...baseMap().tasks, task("c", { phaseId: "p3" })],
      links,
    });
    const result = deleteTask(map, "a", " 重複 ", NOW);
    expect(result.tasks.map((t) => t.id)).toEqual(["b", "c"]);
    expect(result.links.map((l) => l.id)).toEqual(["l3"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ title: "タスク a", reason: "重複", at: NOW });
    expect(result.rejected[0].tasks.map((t) => t.id)).toEqual(["a", "a1"]);
    expect(result.rejected[0].links.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(result.updatedAt).toBe(NOW);
  });

  it("サブタスクだけを消せる。理由が無くてもよい", () => {
    const result = deleteTask(baseMap(), "a1", undefined, NOW);
    expect(result.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(result.rejected[0].reason).toBeUndefined();
    expect(deleteTask(baseMap(), "none", undefined, NOW).rejected).toEqual([]);
  });

  it("restoreRejected でタスクとリンクが戻り、一覧から外れる", () => {
    const map = baseMap({
      tasks: [...baseMap().tasks, task("c", { phaseId: "p3" })],
      links,
    });
    const deleted = deleteTask(map, "a", "重複", NOW);
    const restored = restoreRejected(deleted, 0, NOW);
    expect(restored.rejected).toEqual([]);
    expect(restored.tasks.map((t) => t.id).sort()).toEqual(["a", "a1", "b", "c"]);
    expect(find(restored, "a1").parentId).toBe("a");
    expect(restored.links.map((l) => l.id).sort()).toEqual(["l1", "l2", "l3"]);
  });

  it("相手のタスクがもう無いリンクは戻さない", () => {
    const map = baseMap({ links });
    const deleted = deleteTask(map, "a", undefined, NOW);
    const withoutB = deleteTask(deleted, "b", undefined, NOW);
    const restored = restoreRejected(withoutB, 0, NOW);
    expect(restored.tasks.map((t) => t.id)).toEqual(["a", "a1"]);
    expect(restored.links).toEqual([]);
  });

  it("範囲外の index は何もしない", () => {
    const map = baseMap();
    expect(restoreRejected(map, 0, NOW)).toBe(map);
    expect(restoreRejected(map, -1, NOW)).toBe(map);
  });

  it("元のレーンが消えていたら先頭のレーンに戻す。親が無いサブタスクは親なしで戻す", () => {
    const map = baseMap({ tasks: [task("x", { phaseId: "p3" }), task("x1", { phaseId: "p3", parentId: "x" })] });
    const deleted = deleteTask(deletePhase(deleteTask(map, "x", undefined, NOW), "p3", NOW), "none", undefined, NOW);
    const restored = restoreRejected(deleted, 0, NOW);
    expect(find(restored, "x").phaseId).toBe("p1");
    expect(find(restored, "x1")).toMatchObject({ phaseId: "p1", parentId: "x" });

    const sub = deleteTask(map, "x1", undefined, NOW);
    const parentGone = deleteTask(sub, "x", undefined, NOW);
    const back = restoreRejected(parentGone, 0, NOW);
    expect(find(back, "x1").parentId).toBeUndefined();
  });
});

describe("addTask", () => {
  it("人が足したタスクは human・edited・todo・manual で、order は末尾", () => {
    const map = baseMap({ tasks: [task("a", { order: 2 })] });
    const { map: next, task: added } = addTask(
      map,
      { phaseId: "p1", title: " 新規 ", purpose: "なぜ", milestoneId: "m1" },
      NOW,
    );
    expect(added).toMatchObject({
      origin: "human",
      review: "edited",
      status: "todo",
      statusSource: "manual",
      order: 3,
      title: "新規",
      purpose: "なぜ",
      milestoneId: "m1",
      phaseId: "p1",
    });
    expect(added.parentId).toBeUndefined();
    expect(next.tasks).toHaveLength(2);
    expect(next.updatedAt).toBe(NOW);
  });

  it("サブタスクは親と同じレーンになり、order は親の子の末尾", () => {
    const { task: added } = addTask(
      baseMap(),
      { phaseId: "p3", parentId: "a", title: "子", purpose: "" },
      NOW,
    );
    expect(added).toMatchObject({ phaseId: "p1", parentId: "a", order: 1 });
  });

  it("タイトルが空・レーンや親が無い・サブタスクの下は Error", () => {
    expect(() => addTask(baseMap(), { phaseId: "p1", title: " ", purpose: "" }, NOW)).toThrow();
    expect(() => addTask(baseMap(), { phaseId: "none", title: "x", purpose: "" }, NOW)).toThrow();
    expect(() => addTask(baseMap(), { phaseId: "p1", parentId: "none", title: "x", purpose: "" }, NOW)).toThrow();
    expect(() => addTask(baseMap(), { phaseId: "p1", parentId: "a1", title: "x", purpose: "" }, NOW)).toThrow();
  });
});

describe("レーンの操作", () => {
  it("addPhase は末尾に足す", () => {
    const next = addPhase(baseMap(), " 検証 ", NOW);
    expect(next.phases).toHaveLength(4);
    expect(next.phases[3]).toMatchObject({ name: "検証", order: 3, kinds: [] });
    expect(next.updatedAt).toBe(NOW);
    expect(() => addPhase(baseMap(), " ", NOW)).toThrow();
  });

  it("renamePhase", () => {
    const next = renamePhase(baseMap(), "p2", "開発", NOW);
    expect(next.phases[1].name).toBe("開発");
    const map = baseMap();
    expect(renamePhase(map, "p2", "  ", NOW)).toBe(map);
    expect(renamePhase(map, "none", "x", NOW)).toBe(map);
  });

  it("movePhase は order を入れ替え、端では何もしない", () => {
    const right = movePhase(baseMap(), "p1", 1, NOW);
    const ids = [...right.phases].sort((a, b) => a.order - b.order).map((p) => p.id);
    expect(ids).toEqual(["p2", "p1", "p3"]);
    expect(right.updatedAt).toBe(NOW);
    const map = baseMap();
    expect(movePhase(map, "p1", -1, NOW)).toBe(map);
    expect(movePhase(map, "p3", 1, NOW)).toBe(map);
  });

  it("deletePhase は空のレーンだけ消せる", () => {
    expect(() => deletePhase(baseMap(), "p1", NOW)).toThrow();
    const next = deletePhase(baseMap(), "p3", NOW);
    expect(next.phases.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
