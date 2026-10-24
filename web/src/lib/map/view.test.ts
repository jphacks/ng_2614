import { describe, expect, it } from "vitest";
import type { MapLink, MapPhase, MapStatus, MapTask, SourceKind, WorkflowMap } from "@/lib/types";
import {
  effectiveStatus,
  linksOf,
  purposeChain,
  sortedPhases,
  statusLabel,
  subtasksOf,
  tasksInPhase,
  unconfirmedCount,
} from "./view";

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

function mapOf(tasks: MapTask[], links: MapLink[] = [], phases?: MapPhase[]): WorkflowMap {
  return {
    themeId: "theme",
    phases: phases ?? [
      { id: "p2", name: "実装", order: 1, kinds: [] },
      { id: "p1", name: "調査", order: 0, kinds: [] },
    ],
    milestones: [],
    tasks,
    links,
    rejected: [],
    appliedReviewIds: [],
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
  };
}

function phase(kinds: SourceKind[]): MapPhase {
  return { id: "p", name: "x", order: 0, kinds };
}

describe("statusLabel", () => {
  const statuses: MapStatus[] = ["todo", "doing", "waiting", "done", "rejected"];
  const table: [SourceKind[], string[]][] = [
    [["brainstorm"], ["未着手", "比較中", "保留", "結論あり", "不採用"]],
    [["paper"], ["未着手", "読んでいる", "保留", "読んだ", "不採用"]],
    [["spec"], ["未着手", "draft", "承認待ち", "承認済み", "不採用"]],
    [["commit"], ["未着手", "未commitあり", "待ち", "commit済み", "取りやめ"]],
    [["experiment"], ["未実施", "一部実施", "実行の許可待ち", "実施済み", "取りやめ"]],
    [["meeting"], ["未着手", "資料作成中", "MTG待ち", "MTG済み", "取りやめ"]],
    [["material"], ["未着手", "資料作成中", "MTG待ち", "MTG済み", "取りやめ"]],
    [["todo"], ["未着手", "進行中", "待ち", "完了", "不採用"]],
    [[], ["未着手", "進行中", "待ち", "完了", "不採用"]],
  ];

  it.each(table)("kinds が %j のレーンの言葉", (kinds, expected) => {
    expect(statuses.map((s) => statusLabel(phase(kinds), s))).toEqual(expected);
  });

  it("kinds の先頭で決める。レーンが無ければ既定の言葉", () => {
    expect(statusLabel(phase(["spec", "paper"]), "doing")).toBe("draft");
    expect(statusLabel(undefined, "done")).toBe("完了");
  });
});

describe("effectiveStatus", () => {
  function parentWith(parent: Partial<MapTask>, subs: MapStatus[]) {
    const tasks = [
      task("parent", parent),
      ...subs.map((s, i) => task(`s${i}`, { parentId: "parent", status: s, order: i })),
    ];
    const map = mapOf(tasks);
    return effectiveStatus(map, tasks[0]);
  }

  it("サブタスクが無ければ task.status のまま", () => {
    const t = task("a", { status: "waiting" });
    expect(effectiveStatus(mapOf([t]), t)).toBe("waiting");
  });

  it.each<[MapStatus[], MapStatus]>([
    [["done", "done"], "done"],
    [["done", "rejected"], "done"],
    [["rejected", "rejected"], "rejected"],
    [["doing", "done"], "doing"],
    [["todo", "doing"], "doing"],
    [["waiting", "done"], "waiting"],
    [["waiting", "rejected"], "waiting"],
    [["waiting", "doing"], "doing"],
    [["todo", "todo"], "todo"],
    [["todo", "done"], "doing"],
    [["todo", "waiting"], "doing"],
    [["todo", "rejected"], "todo"],
  ])("サブタスクが %j のとき %s", (subs, expected) => {
    expect(parentWith({ status: "todo" }, subs)).toBe(expected);
  });

  it("サブタスクがすべて todo なら、親の状態（比較中・待ちなど）を残す", () => {
    expect(parentWith({ status: "doing" }, ["todo", "todo"])).toBe("doing");
    expect(parentWith({ status: "waiting" }, ["todo", "rejected"])).toBe("waiting");
  });

  it("statusSource が manual なら task.status のまま", () => {
    expect(parentWith({ status: "todo", statusSource: "manual" }, ["done", "done"])).toBe("todo");
  });
});

describe("並べ替えと取得", () => {
  it("tasksInPhase は親を持たないものだけを order 順に返す。同じ order は元の順", () => {
    const map = mapOf([
      task("c", { order: 2 }),
      task("a", { order: 0 }),
      task("sub", { order: 0, parentId: "a" }),
      task("b1", { order: 1 }),
      task("b2", { order: 1 }),
      task("other", { phaseId: "p2" }),
    ]);
    expect(tasksInPhase(map, "p1").map((t) => t.id)).toEqual(["a", "b1", "b2", "c"]);
    expect(tasksInPhase(map, "none")).toEqual([]);
  });

  it("subtasksOf は order 順", () => {
    const map = mapOf([
      task("a"),
      task("s2", { parentId: "a", order: 2 }),
      task("s1", { parentId: "a", order: 1 }),
      task("x", { parentId: "z" }),
    ]);
    expect(subtasksOf(map, "a").map((t) => t.id)).toEqual(["s1", "s2"]);
  });

  it("sortedPhases は元の配列を変えずに order 順で返す", () => {
    const map = mapOf([]);
    expect(sortedPhases(map).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(map.phases.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("purposeChain", () => {
  const flow = (id: string, from: string, to: string): MapLink => ({
    id,
    fromTaskId: from,
    toTaskId: to,
    kind: "flow",
  });

  it("サブタスクから親へ上がり、flow リンクの from をさかのぼる。問いに近い側が先頭", () => {
    const map = mapOf(
      [task("q"), task("mid"), task("leaf"), task("sub", { parentId: "leaf" })],
      [flow("l1", "q", "mid"), flow("l2", "mid", "leaf")],
    );
    expect(purposeChain(map, "sub").map((t) => t.id)).toEqual(["q", "mid", "leaf", "sub"]);
  });

  it("リンクが無ければ自分だけ。タスクが無ければ空", () => {
    const map = mapOf([task("a")]);
    expect(purposeChain(map, "a").map((t) => t.id)).toEqual(["a"]);
    expect(purposeChain(map, "none")).toEqual([]);
  });

  it("複数あれば最初の flow リンク。impact リンクはたどらない", () => {
    const map = mapOf(
      [task("x"), task("y"), task("z"), task("t")],
      [
        { id: "i", fromTaskId: "z", toTaskId: "t", kind: "impact" },
        flow("l1", "x", "t"),
        flow("l2", "y", "t"),
      ],
    );
    expect(purposeChain(map, "t").map((t) => t.id)).toEqual(["x", "t"]);
  });

  it("flow の from がサブタスクなら、その親へ上がる", () => {
    const map = mapOf(
      [task("p"), task("s", { parentId: "p" }), task("t")],
      [flow("l1", "s", "t")],
    );
    expect(purposeChain(map, "t").map((t) => t.id)).toEqual(["p", "s", "t"]);
  });

  it("循環していても止まる", () => {
    const map = mapOf(
      [task("a"), task("b")],
      [flow("l1", "a", "b"), flow("l2", "b", "a")],
    );
    expect(purposeChain(map, "a").map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("linksOf / unconfirmedCount", () => {
  it("サブタスクを含めて、出ていくリンクと入ってくるリンクを返す", () => {
    const links: MapLink[] = [
      { id: "l1", fromTaskId: "x", toTaskId: "a", kind: "flow" },
      { id: "l2", fromTaskId: "s", toTaskId: "y", kind: "flow" },
      { id: "l3", fromTaskId: "x", toTaskId: "y", kind: "flow" },
      { id: "l4", fromTaskId: "y", toTaskId: "s", kind: "impact" },
    ];
    const map = mapOf(
      [task("a"), task("s", { parentId: "a" }), task("x"), task("y")],
      links,
    );
    const result = linksOf(map, "a");
    expect(result.incoming.map((l) => l.id)).toEqual(["l1", "l4"]);
    expect(result.outgoing.map((l) => l.id)).toEqual(["l2"]);
  });

  it("unconfirmedCount はサブタスクを含めて数える", () => {
    const map = mapOf([
      task("a", { review: "unconfirmed" }),
      task("s", { parentId: "a", review: "unconfirmed" }),
      task("b", { review: "edited" }),
      task("c"),
    ]);
    expect(unconfirmedCount(map)).toBe(2);
  });
});
