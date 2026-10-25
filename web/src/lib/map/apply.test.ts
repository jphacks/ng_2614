import { describe, expect, it } from "vitest";
import type { MapOp, MapTask, WorkflowMap } from "@/lib/types";
import { applyMapOps, normalizeTitle, undoLastUpdate } from "./apply";

const NOW = "2026-10-24T10:00:00.000Z";

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
      { id: "p1", name: "調査", order: 0, kinds: ["brainstorm"] },
      { id: "p2", name: "実装", order: 1, kinds: ["commit"] },
    ],
    milestones: [{ id: "m1", title: "中間発表", done: false }],
    tasks: [task("a"), task("b", { phaseId: "p2" })],
    links: [],
    rejected: [],
    appliedReviewIds: [],
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
    ...overrides,
  };
}

type AddTaskOp = Extract<MapOp, { op: "add_task" }>;

function addOp(tempId: string, overrides: Partial<AddTaskOp> = {}): AddTaskOp {
  return {
    op: "add_task",
    tempId,
    phaseId: "p1",
    title: `新しい ${tempId}`,
    purpose: "目的",
    status: "todo",
    statusSource: "ai",
    sources: [],
    commitShas: [],
    reviewIds: [],
    reason: `${tempId} を足す`,
    ...overrides,
  };
}

function update(taskId: string, fields: Partial<Extract<MapOp, { op: "update_task" }>>): MapOp {
  return { op: "update_task", taskId, reason: "更新", ...fields };
}

describe("normalizeTitle", () => {
  it("前後の空白・全角半角・大文字小文字の違いを無視する", () => {
    expect(normalizeTitle("  ＧＰＵ　実験 ")).toBe(normalizeTitle("gpu 実験"));
    expect(normalizeTitle("Ａ１")).toBe("a1");
    expect(normalizeTitle("a  b")).toBe("a b");
  });
});

describe("applyMapOps: add_task", () => {
  it("足したタスクは ai・unconfirmed で、order は同じレーン・同じ親の末尾", () => {
    const map = baseMap({ tasks: [task("a", { order: 3 })] });
    const result = applyMapOps(map, [addOp("t1"), addOp("t2")], "r1", NOW);
    const added = result.map.tasks.slice(1);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({
      origin: "ai",
      review: "unconfirmed",
      order: 4,
      phaseId: "p1",
      title: "新しい t1",
    });
    expect(added[1].order).toBe(5);
    expect(added[0].id).not.toBe("t1");
    expect(result.applied).toHaveLength(2);
    expect(result.skipped).toEqual([]);
  });

  it("tempId を後ろの op の parentId・add_link で使える。親のレーンに合わせる", () => {
    const ops: MapOp[] = [
      addOp("parent", { phaseId: "p2" }),
      addOp("child", { parentId: "parent", phaseId: "p1" }),
      { op: "add_link", fromTaskId: "a", toTaskId: "parent", kind: "flow", reason: "つなぐ" },
    ];
    const result = applyMapOps(baseMap(), ops, "r1", NOW);
    const parent = result.map.tasks.find((t) => t.title === "新しい parent");
    const child = result.map.tasks.find((t) => t.title === "新しい child");
    expect(child?.parentId).toBe(parent?.id);
    expect(child?.phaseId).toBe("p2");
    expect(result.map.links).toHaveLength(1);
    expect(result.map.links[0]).toMatchObject({ fromTaskId: "a", toTaskId: parent?.id, reason: "つなぐ" });
    expect(result.applied).toHaveLength(3);
  });

  it("既存のタスクの下にサブタスクを足せる。サブタスクの下には足せない", () => {
    const map = baseMap({ tasks: [task("a"), task("sub", { parentId: "a" })] });
    const result = applyMapOps(
      map,
      [addOp("x", { parentId: "a" }), addOp("y", { parentId: "sub" })],
      "r1",
      NOW,
    );
    expect(result.applied).toHaveLength(1);
    expect(result.skipped[0].why).toContain("サブタスク");
  });

  it("却下の一覧と同じタイトルは、全角半角・空白の違いがあっても足さない", () => {
    const map = baseMap({
      rejected: [{ title: "ＧＰＵ 実験", at: NOW, tasks: [], links: [] }],
    });
    const result = applyMapOps(map, [addOp("t", { title: " gpu　実験 " })], "r1", NOW);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].why).toContain("却下");
    expect(result.map.tasks).toHaveLength(2);
  });

  it("同じレーン・同じ親に同じタイトルがあれば足さない。別のレーンなら足す", () => {
    const map = baseMap({ tasks: [task("a", { title: "調査する" })] });
    const result = applyMapOps(
      map,
      [
        addOp("same", { title: "調査する" }),
        addOp("other", { title: "調査する", phaseId: "p2" }),
        addOp("dup1", { title: "二重" }),
        addOp("dup2", { title: "二重" }),
      ],
      "r1",
      NOW,
    );
    expect(result.applied.map((o) => (o as AddTaskOp).tempId)).toEqual(["other", "dup1"]);
    expect(result.skipped.map((s) => (s.op as AddTaskOp).tempId)).toEqual(["same", "dup2"]);
  });

  it("status が rejected で rejectReason が無いものは当てはめない。空白だけも不可", () => {
    const result = applyMapOps(
      baseMap(),
      [
        addOp("n1", { status: "rejected" }),
        addOp("n2", { status: "rejected", rejectReason: "  " }),
        addOp("ok", { status: "rejected", rejectReason: " 手法が合わない " }),
      ],
      "r1",
      NOW,
    );
    expect(result.skipped).toHaveLength(2);
    const added = result.map.tasks.find((t) => t.title === "新しい ok");
    expect(added).toMatchObject({ status: "rejected", rejectReason: "手法が合わない" });
  });

  it("足されなかったタスクの tempId を使う後ろの op も当てはめない", () => {
    const map = baseMap({
      rejected: [{ title: "不採用", at: NOW, tasks: [], links: [] }],
    });
    const result = applyMapOps(
      map,
      [
        addOp("p", { title: "不採用" }),
        addOp("c", { parentId: "p" }),
        { op: "add_link", fromTaskId: "a", toTaskId: "p", kind: "flow", reason: "r" },
      ],
      "r1",
      NOW,
    );
    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(3);
  });

  it("存在しないレーンには足さない。milestoneId が無ければ付けない", () => {
    const result = applyMapOps(
      baseMap(),
      [
        addOp("x", { phaseId: "nothing" }),
        addOp("y", { milestoneId: "nothing" }),
        addOp("z", { milestoneId: "m1" }),
      ],
      "r1",
      NOW,
    );
    expect(result.skipped).toHaveLength(1);
    expect(result.map.tasks.find((t) => t.title === "新しい y")?.milestoneId).toBeUndefined();
    expect(result.map.tasks.find((t) => t.title === "新しい z")?.milestoneId).toBe("m1");
  });
});

describe("applyMapOps: update_task の保護", () => {
  const fields = { title: "新題", purpose: "新目的", status: "done" as const };

  it("unconfirmed は title・purpose・status を変える。statusSource が無ければ前のまま", () => {
    const map = baseMap({ tasks: [task("a", { statusSource: "ai" })] });
    const result = applyMapOps(map, [update("a", fields)], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({
      title: "新題",
      purpose: "新目的",
      status: "done",
      statusSource: "ai",
    });
  });

  it("statusSource が来たら、状態を変えるときにその値にする", () => {
    const result = applyMapOps(
      baseMap({ tasks: [task("a", { statusSource: "ai" })] }),
      [update("a", { status: "doing", statusSource: "ai", statusRaw: "draft" })],
      "r1",
      NOW,
    );
    expect(result.map.tasks[0]).toMatchObject({ status: "doing", statusSource: "ai", statusRaw: "draft" });
  });

  it("record のタスクの状態を ai の推測で上書きしない（statusRaw・rejectReason も）。ほかの項目は通る", () => {
    const map = baseMap({
      tasks: [task("a", { statusSource: "record", status: "todo", statusRaw: "todo" })],
    });
    const only = applyMapOps(
      map,
      [update("a", { status: "doing", statusSource: "ai", statusRaw: "draft" })],
      "r1",
      NOW,
    );
    expect(only.applied).toEqual([]);
    expect(only.skipped[0].why).toContain("記録を優先");
    expect(only.map.tasks[0]).toMatchObject({ status: "todo", statusSource: "record", statusRaw: "todo" });

    const mixed = applyMapOps(
      map,
      [update("a", { status: "doing", statusSource: "ai", result: "結果" })],
      "r2",
      NOW,
    );
    expect(mixed.applied).toHaveLength(1);
    expect(mixed.map.tasks[0]).toMatchObject({ status: "todo", statusSource: "record", result: "結果" });

    const rejected = baseMap({
      tasks: [task("a", { statusSource: "record", status: "rejected", rejectReason: "もとの理由" })],
    });
    const reason = applyMapOps(
      rejected,
      [update("a", { rejectReason: "AI の推測", statusSource: "ai" })],
      "r3",
      NOW,
    );
    expect(reason.map.tasks[0].rejectReason).toBe("もとの理由");
  });

  it("record の op は ai のタスクの状態を変えてよい", () => {
    const map = baseMap({ tasks: [task("a", { statusSource: "ai" })] });
    const result = applyMapOps(map, [update("a", { status: "done", statusSource: "record" })], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({ status: "done", statusSource: "record" });
  });

  it("edited は title・purpose・status を変えない", () => {
    const map = baseMap({ tasks: [task("a", { review: "edited" })] });
    const result = applyMapOps(map, [update("a", fields)], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({ title: "タスク a", purpose: "目的", status: "todo" });
    expect(result.applied).toEqual([]);
    expect(result.skipped[0].why).toContain("title");
    expect(result.skipped[0].why).toContain("status");
  });

  it("confirmed は title・purpose を変えず、status は変える", () => {
    const map = baseMap({ tasks: [task("a", { review: "confirmed" })] });
    const result = applyMapOps(map, [update("a", fields)], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({ title: "タスク a", purpose: "目的", status: "done" });
    expect(result.applied).toHaveLength(1);
  });

  it("manual は status を変えず、title・purpose は変える", () => {
    const map = baseMap({ tasks: [task("a", { statusSource: "manual" })] });
    const result = applyMapOps(map, [update("a", { ...fields, statusRaw: "x" })], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({
      title: "新題",
      purpose: "新目的",
      status: "todo",
      statusSource: "manual",
    });
    expect(result.map.tasks[0].statusRaw).toBeUndefined();
  });

  it("rejected にするときは rejectReason が要る。rejected 以外にすると理由を消す", () => {
    const noReason = applyMapOps(baseMap(), [update("a", { status: "rejected", title: "変える" })], "r1", NOW);
    expect(noReason.applied).toEqual([]);
    expect(noReason.map.tasks[0].title).toBe("タスク a");

    const withReason = applyMapOps(
      baseMap(),
      [update("a", { status: "rejected", rejectReason: "合わない" })],
      "r1",
      NOW,
    );
    expect(withReason.map.tasks[0]).toMatchObject({ status: "rejected", rejectReason: "合わない" });

    const back = applyMapOps(withReason.map, [update("a", { status: "doing" })], "r2", NOW);
    expect(back.map.tasks[0].status).toBe("doing");
    expect(back.map.tasks[0].rejectReason).toBeUndefined();
  });

  it("すでに rejected で理由があるタスクへの rejected は、理由が無くても通る", () => {
    const map = baseMap({
      tasks: [task("a", { status: "rejected", rejectReason: "前の理由" })],
    });
    const result = applyMapOps(map, [update("a", { status: "rejected", result: "結果" })], "r1", NOW);
    expect(result.map.tasks[0]).toMatchObject({ rejectReason: "前の理由", result: "結果" });
  });

  it("存在しないタスク・変化の無い更新は skipped に入る", () => {
    const result = applyMapOps(
      baseMap(),
      [update("none", { status: "done" }), update("a", { status: "todo" })],
      "r1",
      NOW,
    );
    expect(result.skipped.map((s) => s.why)).toEqual(["タスクが見つからない", "すでに同じ内容"]);
  });

  it("同じ op の中の tempId のタスクも更新できる", () => {
    const result = applyMapOps(
      baseMap(),
      [addOp("t"), update("t", { status: "doing" })],
      "r1",
      NOW,
    );
    expect(result.map.tasks.find((t) => t.title === "新しい t")?.status).toBe("doing");
  });
});

describe("applyMapOps: link_task / add_link", () => {
  it("link_task は edited にも許され、出典・コミット・判定を重複なく足す", () => {
    const map = baseMap({
      tasks: [
        task("a", {
          review: "edited",
          sources: [{ kind: "spec", path: "s.md" }],
          commitShas: ["abc"],
        }),
      ],
    });
    const result = applyMapOps(
      map,
      [
        {
          op: "link_task",
          taskId: "a",
          sources: [
            { kind: "spec", path: "s.md" },
            { kind: "paper", path: "p.md" },
          ],
          commitShas: ["abc", "def"],
          reviewIds: ["r9"],
          reason: "出典を足す",
        },
      ],
      "r1",
      NOW,
    );
    expect(result.map.tasks[0].sources.map((s) => s.path)).toEqual(["s.md", "p.md"]);
    expect(result.map.tasks[0].commitShas).toEqual(["abc", "def"]);
    expect(result.map.tasks[0].reviewIds).toEqual(["r9"]);
    expect(result.map.tasks[0].title).toBe("タスク a");
  });

  it("link_task で足すものが無ければ skipped", () => {
    const result = applyMapOps(
      baseMap(),
      [{ op: "link_task", taskId: "a", commitShas: [], reason: "r" }],
      "r1",
      NOW,
    );
    expect(result.skipped).toHaveLength(1);
  });

  it("add_link は両端が無いもの、同じ from・to・kind があるものを足さない", () => {
    const map = baseMap({
      links: [{ id: "l1", fromTaskId: "a", toTaskId: "b", kind: "flow" }],
    });
    const result = applyMapOps(
      map,
      [
        { op: "add_link", fromTaskId: "a", toTaskId: "b", kind: "flow", reason: "重複" },
        { op: "add_link", fromTaskId: "a", toTaskId: "zzz", kind: "flow", reason: "相手なし" },
        { op: "add_link", fromTaskId: "a", toTaskId: "a", kind: "flow", reason: "自分" },
        { op: "add_link", fromTaskId: "b", toTaskId: "a", kind: "impact", findingId: "f1", reason: "影響" },
      ],
      "r1",
      NOW,
    );
    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toHaveLength(3);
    expect(result.map.links).toHaveLength(2);
    expect(result.map.links[1]).toMatchObject({ kind: "impact", findingId: "f1", reason: "影響" });
  });
});

describe("applyMapOps: 記録と取り消し", () => {
  it("previous・lastUpdate・appliedReviewIds を更新し、入力を書き換えない", () => {
    const map = baseMap();
    const before = JSON.stringify(map);
    const result = applyMapOps(
      map,
      [
        addOp("t", { reason: "足した" }),
        update("a", { status: "doing", reason: "進めた" }),
        update("b", { status: "todo", reason: "変化なし" }),
      ],
      "r1",
      NOW,
    );
    expect(JSON.stringify(map)).toBe(before);
    const added = result.map.tasks.find((t) => t.title === "新しい t");
    expect(result.map.lastUpdate).toEqual({
      reviewId: "r1",
      at: NOW,
      summaries: ["足した", "進めた"],
      changedTaskIds: [added?.id, "a"],
    });
    expect(result.map.appliedReviewIds).toEqual(["r1"]);
    expect(result.map.updatedAt).toBe(NOW);
    expect(result.map.previous).toEqual(map);
    expect(result.map.previous).not.toHaveProperty("previous");
  });

  it("previous の中の previous は持たない", () => {
    const first = applyMapOps(baseMap(), [update("a", { status: "doing" })], "r1", NOW).map;
    const second = applyMapOps(first, [update("a", { status: "done" })], "r2", NOW).map;
    expect(second.previous?.tasks[0].status).toBe("doing");
    expect(second.previous).not.toHaveProperty("previous");
    expect(second.appliedReviewIds).toEqual(["r1", "r2"]);
  });

  it("1つも当てはめなかったときは appliedReviewIds だけ足す", () => {
    const first = applyMapOps(baseMap(), [update("a", { status: "doing" })], "r1", NOW).map;
    const result = applyMapOps(first, [update("none", { status: "done" })], "r2", NOW);
    expect(result.map.appliedReviewIds).toEqual(["r1", "r2"]);
    expect(result.map.previous).toBe(first.previous);
    expect(result.map.lastUpdate).toBe(first.lastUpdate);
    expect(result.map.tasks).toBe(first.tasks);
  });


  it("undoLastUpdate は更新前に戻し、reviewId は残す。previous が無ければ undefined", () => {
    const map = baseMap({ appliedReviewIds: ["r0"] });
    expect(undoLastUpdate(map)).toBeUndefined();
    const updated = applyMapOps(map, [addOp("t"), update("a", { status: "done" })], "r1", NOW).map;
    const undone = undoLastUpdate(updated);
    expect(undone?.tasks).toEqual(map.tasks);
    expect(undone?.appliedReviewIds).toEqual(["r0", "r1"]);
    expect(undone?.previous).toBeUndefined();
    expect(undone?.lastUpdate).toBeUndefined();
    expect(undone && undoLastUpdate(undone)).toBeUndefined();
  });
});

// types.ts の MapOp には key が無いので、型を通すために MapOp として返す
function keyed(op: AddTaskOp, key: string): MapOp {
  return { ...op, key } as MapOp;
}

describe("applyMapOps: key", () => {
  it("add_task の key を MapTask の key に入れる。同じ key のタスクがあれば足さない", () => {
    const first = applyMapOps(baseMap(), [keyed(addOp("t1"), "specs/a.md")], "r1", NOW);
    expect(first.map.tasks.find((t) => t.title === "新しい t1")?.key).toBe("specs/a.md");
    const again = applyMapOps(first.map, [keyed(addOp("t2"), "specs/a.md")], "r2", NOW);
    expect(again.skipped[0].why).toContain("key");
  });

  it("人が消したタスクと同じ key の提案は、タイトルが変わっていても足さない", () => {
    const gone = task("g", { key: "specs/g.md", title: "消したタスク" });
    const map = baseMap({
      rejected: [{ title: "消したタスク", at: NOW, tasks: [gone], links: [] }],
    });
    const result = applyMapOps(
      map,
      [keyed(addOp("t", { title: "別の題" }), "specs/g.md")],
      "r1",
      NOW,
    );
    expect(result.applied).toEqual([]);
  });
});

describe("undoLastUpdate: 更新のあとの人の手直しを残す", () => {
  const LATER = "2026-10-24T11:00:00.000Z";

  // a を done にし、新しいタスク t（と子 u）とリンクを足した更新のあとのマップ
  function updated() {
    const map = baseMap({
      tasks: [task("a"), task("b", { phaseId: "p2" }), task("c", { order: 1 })],
      appliedReviewIds: ["r0"],
    });
    const ops: MapOp[] = [
      update("a", { status: "done", result: "PASS" }),
      addOp("t"),
      addOp("u", { parentId: "t" }),
      { op: "add_link", fromTaskId: "a", toTaskId: "t", kind: "flow", reason: "a から t へ" },
      { op: "add_link", fromTaskId: "a", toTaskId: "b", kind: "impact", reason: "a が b に影響" },
    ];
    return { before: map, after: applyMapOps(map, ops, "r1", NOW).map };
  }

  it("更新で足したタスク・リンクを消し、変えたタスクを戻す", () => {
    const { before, after } = updated();
    const undone = undoLastUpdate(after)!;
    expect(undone.tasks).toEqual(before.tasks);
    expect(undone.links).toEqual([]);
    expect(undone.lastUpdate).toBeUndefined();
    expect(undone.previous).toBeUndefined();
  });

  it("ほかのタスクの編集・削除・レーンの変更は残る", () => {
    const { after } = updated();
    const tasks = after.tasks
      .filter((t) => t.id !== "b") // 人が消した
      .map((t) =>
        t.id === "c" ? { ...t, title: "人が直した題", review: "edited" as const, phaseId: "p2" } : t,
      );
    const human: WorkflowMap = {
      ...after,
      tasks,
      phases: [...after.phases, { id: "p3", name: "人が足したレーン", order: 2, kinds: [] }],
      rejected: [{ title: "タスク b", at: LATER, tasks: [], links: [] }],
      updatedAt: LATER,
    };
    const undone = undoLastUpdate(human)!;
    expect(undone.tasks.find((t) => t.id === "b")).toBeUndefined();
    expect(undone.tasks.find((t) => t.id === "c")).toMatchObject({
      title: "人が直した題",
      review: "edited",
      phaseId: "p2",
    });
    expect(undone.tasks.find((t) => t.id === "a")).toMatchObject({ status: "todo" });
    expect(undone.tasks.find((t) => t.id === "a")).not.toHaveProperty("result");
    expect(undone.phases).toHaveLength(3);
    expect(undone.rejected).toHaveLength(1);
    expect(undone.updatedAt).toBe(LATER);
    // 更新で足したリンクは2本とも消える
    expect(undone.links).toEqual([]);
  });

  it("更新のあとで人が直したタスクは戻さない（変えたタスクも、足したタスクも）", () => {
    const { after } = updated();
    const added = after.tasks.find((t) => t.title === "新しい t")!;
    const tasks = after.tasks.map((t) => {
      if (t.id === "a") return { ...t, status: "doing" as const, statusSource: "manual" as const };
      if (t.id === added.id) return { ...t, title: "人が直した", review: "edited" as const };
      return t;
    });
    const undone = undoLastUpdate({ ...after, tasks })!;
    expect(undone.tasks.find((t) => t.id === "a")).toMatchObject({
      status: "doing",
      statusSource: "manual",
    });
    expect(undone.tasks.find((t) => t.id === added.id)?.title).toBe("人が直した");
    // 更新で足したリンクは、つなぎ先のタスクを残しても消える
    expect(undone.links).toEqual([]);
    // 子 u は人が直していないので消える
    expect(undone.tasks.some((t) => t.title === "新しい u")).toBe(false);
  });

  it("人が足したサブタスクを持つ親は、足したタスクでも残す", () => {
    const { after } = updated();
    const added = after.tasks.find((t) => t.title === "新しい t")!;
    const human: MapTask = task("h", {
      parentId: added.id,
      origin: "human",
      review: "edited",
      statusSource: "manual",
    });
    const undone = undoLastUpdate({ ...after, tasks: [...after.tasks, human] })!;
    expect(undone.tasks.some((t) => t.id === added.id)).toBe(true);
    expect(undone.tasks.some((t) => t.id === "h")).toBe(true);
  });

  it("レーンやマイルストーンの付け替えは、変えたタスクを戻しても残る", () => {
    const { after } = updated();
    const tasks = after.tasks.map((t) =>
      t.id === "a" ? { ...t, phaseId: "p2", milestoneId: "m1", order: 9 } : t,
    );
    const undone = undoLastUpdate({ ...after, tasks })!;
    expect(undone.tasks.find((t) => t.id === "a")).toMatchObject({
      status: "todo",
      phaseId: "p2",
      milestoneId: "m1",
      order: 9,
    });
  });
});
