import { describe, expect, it } from "vitest";
import type { MapLink, MapTask, Review, WorkflowMap } from "@/lib/types";
import { applyMapOps } from "./apply";
import { diffToOps, mergeMilestones, reviewLinkOps } from "./merge";

const NOW = "2026-10-24T10:00:00.000Z";

// current の "a" と fresh の "fa"（key "doc/a.md"）が同じタスクになるよう、タイトルは key から決める
function task(id: string, overrides: Partial<MapTask> = {}): MapTask {
  const key = "key" in overrides ? overrides.key : `doc/${id}.md`;
  return {
    id,
    key,
    phaseId: "p1",
    order: 0,
    title: `タスク ${key ? key.replace(/^doc\/|\.md$/g, "") : id}`,
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

function link(id: string, from: string, to: string, overrides: Partial<MapLink> = {}): MapLink {
  return { id, fromTaskId: from, toTaskId: to, kind: "flow", reason: "つなぐ", ...overrides };
}

function mapOf(tasks: MapTask[], overrides: Partial<WorkflowMap> = {}): WorkflowMap {
  return {
    themeId: "theme",
    phases: [
      { id: "p1", name: "調査", order: 0, kinds: ["brainstorm"] },
      { id: "p2", name: "実装", order: 1, kinds: ["commit"] },
    ],
    milestones: [],
    tasks,
    links: [],
    rejected: [],
    appliedReviewIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("diffToOps", () => {
  it("同じ内容なら変更は無い。key の無いタスクは対象外", () => {
    const current = mapOf([task("a"), task("manual", { key: undefined })]);
    const fresh = mapOf([
      task("fa", { key: "doc/a.md" }),
      task("fx", { key: undefined, title: "key の無い新しいタスク" }),
    ]);
    expect(diffToOps(current, fresh)).toEqual([]);
  });

  it("current に無い key は add_task（key・tempId・reason 付き）。親を先に、サブタスクを後に並べる", () => {
    const current = mapOf([task("a")]);
    const fresh = mapOf([
      task("child", { key: "doc/child.md", parentId: "parent" }),
      task("parent", { key: "doc/parent.md", sources: [{ kind: "spec", path: "doc/parent.md" }] }),
    ]);
    const ops = diffToOps(current, fresh);
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({
      op: "add_task",
      key: "doc/parent.md",
      tempId: "parent",
      title: "タスク parent",
      statusSource: "record",
    });
    expect(ops[0].reason).toContain("spec");
    expect(ops[1]).toMatchObject({ op: "add_task", tempId: "child", parentId: "parent" });
    expect(ops[1].reason).toContain("サブタスク");
  });

  it("親が current にあれば、サブタスクの parentId は current の id", () => {
    const current = mapOf([task("a")]);
    const fresh = mapOf([
      task("fa", { key: "doc/a.md" }),
      task("c", { key: "doc/c.md", parentId: "fa" }),
    ]);
    const [op] = diffToOps(current, fresh);
    expect(op).toMatchObject({ op: "add_task", parentId: "a" });
  });

  it("親が対応しないサブタスクは足さない", () => {
    const fresh = mapOf([
      task("p", { key: undefined }),
      task("c", { key: "doc/c.md", parentId: "p" }),
    ]);
    expect(diffToOps(mapOf([]), fresh)).toEqual([]);
  });

  it("title・purpose・status が違えば update_task。空の purpose では上書きしない", () => {
    const current = mapOf([task("a", { status: "todo" })]);
    const fresh = mapOf([
      task("fa", {
        key: "doc/a.md",
        title: "新しい題",
        purpose: "",
        status: "doing",
        statusRaw: "draft",
        result: "L0 PASS",
      }),
    ]);
    const ops = diffToOps(current, fresh);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      op: "update_task",
      taskId: "a",
      title: "新しい題",
      status: "doing",
      statusSource: "record",
      statusRaw: "draft",
      result: "L0 PASS",
    });
    expect(ops[0]).not.toHaveProperty("purpose");
  });

  it("タイトルの違いが空白・全角半角だけなら update_task にしない", () => {
    const current = mapOf([task("a", { title: "GPU 実験" })]);
    const fresh = mapOf([task("fa", { key: "doc/a.md", title: " ＧＰＵ　実験 " })]);
    expect(diffToOps(current, fresh)).toEqual([]);
  });

  it("状態の優先順位に反する変更（record を ai で、manual を上書き）は op にしない。ai → record は出す", () => {
    const current = mapOf([
      task("r", { statusSource: "record", status: "todo" }),
      task("m", { statusSource: "manual", status: "todo" }),
      task("i", { statusSource: "ai", status: "todo" }),
    ]);
    const fresh = mapOf([
      task("fr", { key: "doc/r.md", statusSource: "ai", status: "doing" }),
      task("fm", { key: "doc/m.md", statusSource: "record", status: "done" }),
      task("fi", { key: "doc/i.md", statusSource: "record", status: "todo" }),
    ]);
    const ops = diffToOps(current, fresh);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "update_task", taskId: "i", statusSource: "record" });
  });

  it("sources・commitShas が増えていれば link_task（増えた分だけ）", () => {
    const src = { kind: "spec" as const, path: "doc/a.md" };
    const current = mapOf([task("a", { sources: [src], commitShas: ["aaa"] })]);
    const fresh = mapOf([
      task("fa", {
        key: "doc/a.md",
        sources: [src, { kind: "commit", path: "bbb" }],
        commitShas: ["aaa", "bbb"],
      }),
    ]);
    const ops = diffToOps(current, fresh);
    expect(ops).toEqual([
      {
        op: "link_task",
        taskId: "a",
        sources: [{ kind: "commit", path: "bbb" }],
        commitShas: ["bbb"],
        reason: expect.any(String),
      },
    ]);
  });

  it("fresh に無い current のタスクは消さない", () => {
    const ops = diffToOps(mapOf([task("a"), task("b")]), mapOf([task("fa", { key: "doc/a.md" })]));
    expect(ops).toEqual([]);
  });

  it("両端が対応するリンクで current に無いものだけ add_link", () => {
    const current = mapOf([task("a"), task("b")], { links: [link("l0", "a", "b")] });
    const fresh = mapOf(
      [
        task("fa", { key: "doc/a.md" }),
        task("fb", { key: "doc/b.md" }),
        task("fc", { key: "doc/c.md" }),
        task("fm", { key: undefined }),
      ],
      {
        links: [
          link("x1", "fa", "fb"), // もうある
          link("x2", "fb", "fc", { kind: "impact", findingId: "f1", reason: "影響" }),
          link("x3", "fa", "fm"), // key の無い端
        ],
      },
    );
    const ops = diffToOps(current, fresh);
    expect(ops.filter((o) => o.op === "add_link")).toEqual([
      {
        op: "add_link",
        fromTaskId: "b",
        toTaskId: "fc", // 足すタスクは tempId（fresh の id）
        kind: "impact",
        findingId: "f1",
        reason: "影響",
      },
    ]);
  });

  it("applyMapOps に通すと、足したタスクに key が入り、サブタスクとリンクもつながる", () => {
    const current = mapOf([task("a")]);
    const fresh = mapOf(
      [
        task("fa", { key: "doc/a.md" }),
        task("n", { key: "doc/n.md" }),
        task("nc", { key: "doc/nc.md", parentId: "n" }),
      ],
      { links: [link("l", "fa", "n")] },
    );
    const result = applyMapOps(current, diffToOps(current, fresh), "workspace", NOW);
    expect(result.skipped).toEqual([]);
    const n = result.map.tasks.find((t) => t.key === "doc/n.md")!;
    const nc = result.map.tasks.find((t) => t.key === "doc/nc.md")!;
    expect(nc.parentId).toBe(n.id);
    expect(result.map.links).toHaveLength(1);
    expect(result.map.links[0]).toMatchObject({ fromTaskId: "a", toTaskId: n.id });
    // もう一度同じ fresh を当てても何も起きない
    expect(diffToOps(result.map, fresh)).toEqual([]);
  });

  it("人が消したタスク（rejected）は、作り直しても足されない", () => {
    const gone = task("g", { key: "doc/g.md", title: "消したタスク" });
    const current = mapOf([task("a")], {
      rejected: [{ title: gone.title, at: NOW, tasks: [gone], links: [] }],
    });
    const fresh = mapOf([
      task("fa", { key: "doc/a.md" }),
      task("fg", { key: "doc/g.md", title: "消したタスク（改題）" }),
    ]);
    const result = applyMapOps(current, diffToOps(current, fresh), "workspace", NOW);
    expect(result.applied).toEqual([]);
    expect(result.map.tasks).toHaveLength(1);
  });

  it("人が直したタスクの文言は、作り直しの差分で上書きされない", () => {
    const current = mapOf([task("a", { review: "edited", title: "人が直した題" })]);
    const fresh = mapOf([task("fa", { key: "doc/a.md", title: "ワークスペースの題" })]);
    const result = applyMapOps(current, diffToOps(current, fresh), "workspace", NOW);
    expect(result.map.tasks[0].title).toBe("人が直した題");
  });
});

describe("mergeMilestones", () => {
  it("current に無いものを足し、current の並び（人の並べ替え）は変えない", () => {
    const current = mapOf([], {
      milestones: [
        { id: "m2", title: "後半", done: false },
        { id: "m1", title: "中間発表", done: false },
      ],
    });
    const fresh = mapOf([], {
      milestones: [
        { id: "m1", title: "中間発表", done: false },
        { id: "m2", title: "後半", done: false },
        { id: "m3", title: "最終発表", done: false },
      ],
    });
    expect(mergeMilestones(current, fresh).map((m) => m.id)).toEqual(["m2", "m1", "m3"]);
  });

  it("done は fresh に合わせる。fresh が空（部分的な更新）なら current のまま", () => {
    const current = mapOf([], { milestones: [{ id: "m1", title: "中間発表", done: false }] });
    const fresh = mapOf([], { milestones: [{ id: "m1", title: "中間発表", done: true }] });
    expect(mergeMilestones(current, fresh)).toEqual([{ id: "m1", title: "中間発表", done: true }]);
    expect(mergeMilestones(current, mapOf([]))).toEqual(current.milestones);
  });

  it("id が違っても同じタイトルのものは足さない", () => {
    const current = mapOf([], { milestones: [{ id: "x", title: "中間発表", done: false }] });
    const fresh = mapOf([], { milestones: [{ id: "y", title: " 中間発表 ", done: false }] });
    expect(mergeMilestones(current, fresh)).toHaveLength(1);
  });
});

describe("reviewLinkOps", () => {
  function review(sha: string): Review {
    return {
      id: "rev1",
      themeId: "theme",
      purpose: "p",
      commitSha: sha,
      commitMessage: "m",
      createdAt: NOW,
      findings: [],
    };
  }

  it("key が commit:<sha> のタスクと、commitShas に含むタスクに link_task を付ける", () => {
    const map = mapOf([
      task("c", { key: "commit:abc123" }),
      task("d", { key: "doc/d.md", commitShas: ["abc123"] }),
      task("e", { key: "commit:zzz" }),
    ]);
    const ops = reviewLinkOps(map, review("abc123"));
    expect(ops.map((o) => (o.op === "link_task" ? o.taskId : ""))).toEqual(["c", "d"]);
    expect(ops[0]).toMatchObject({
      op: "link_task",
      commitShas: ["abc123"],
      reviewIds: ["rev1"],
    });
  });

  it("該当のタスクが無い、sha が空（フック）、すでに結び付いているときは空", () => {
    const map = mapOf([task("c", { key: "commit:abc123", commitShas: ["abc123"], reviewIds: ["rev1"] })]);
    expect(reviewLinkOps(mapOf([task("x")]), review("abc123"))).toEqual([]);
    expect(reviewLinkOps(map, review(""))).toEqual([]);
    expect(reviewLinkOps(map, review("abc123"))).toEqual([]);
  });

  it("applyMapOps で reviewIds と commitShas が足される", () => {
    const map = mapOf([task("c", { key: "commit:abc123" })]);
    const result = applyMapOps(map, reviewLinkOps(map, review("abc123")), "rev1", NOW);
    expect(result.map.tasks[0]).toMatchObject({ reviewIds: ["rev1"], commitShas: ["abc123"] });
  });
});
