import { describe, expect, it } from "vitest";
import { parseDoc, parseMilestones, type WorkspaceDoc } from "./parse";
import {
  DEFAULT_PHASES,
  PHASE_IDS,
  buildSkeleton,
  taskIdForKey,
  type ImplCommit,
  type SkeletonInput,
} from "./skeleton";

const PROJECT = "sample-project";
const LAB = `.research/lab/projects/${PROJECT}`;
const BS = ".research/secretary/notes/brainstorm";
const REPO = "example-org/research-workspace";
const SHA = "f".repeat(40);

function doc(path: string, frontmatter: string[], title = "タイトル"): WorkspaceDoc {
  const text = `---\nproject: ${PROJECT}\n${frontmatter.join("\n")}\n---\n# ${title}\n`;
  const parsed = parseDoc({ path, text }, PROJECT);
  if (!parsed) throw new Error(`読めないパス: ${path}`);
  return parsed;
}

const sha = (prefix: string) => prefix.padEnd(40, "0");

function commit(prefix: string, date: string, message = `feat: ${prefix}`): ImplCommit {
  return {
    sha: sha(prefix),
    message,
    url: `https://github.com/example-org/impl/commit/${sha(prefix)}`,
    date,
  };
}

function input(overrides: Partial<SkeletonInput>): SkeletonInput {
  return {
    themeId: "theme-1",
    workspaceRepo: REPO,
    workspaceProject: PROJECT,
    workspaceSha: SHA,
    docs: [],
    milestones: [],
    commits: [],
    now: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

function taskOf(map: ReturnType<typeof buildSkeleton>, key: string) {
  const task = map.tasks.find((t) => t.key === key);
  if (!task) throw new Error(`タスクが無い: ${key}`);
  return task;
}

describe("taskIdForKey", () => {
  it("同じ key なら同じ id、違う key なら違う id", () => {
    expect(taskIdForKey(`${LAB}/specs/a.md`)).toBe(taskIdForKey(`${LAB}/specs/a.md`));
    expect(taskIdForKey(`${LAB}/specs/a.md`)).not.toBe(taskIdForKey(`${LAB}/specs/b.md`));
    expect(taskIdForKey("commit:abc")).toMatch(/^wm-[0-9a-z]+$/);
  });

  it("作り直しても骨格のタスクの id は変わらない", () => {
    const docs = [doc(`${LAB}/specs/2026-10-20-a.md`, ["status: draft"])];
    const a = buildSkeleton(input({ docs }));
    const b = buildSkeleton(input({ docs, now: "2026-10-25T00:00:00.000Z" }));
    expect(a.tasks.map((t) => t.id)).toEqual(b.tasks.map((t) => t.id));
    expect(a.tasks[0].id).toBe(taskIdForKey(`${LAB}/specs/2026-10-20-a.md`));
  });
});

describe("buildSkeleton の基本", () => {
  it("レーン・メタ情報・タスクの共通の項目を入れる", () => {
    const path = `${LAB}/specs/2026-10-20-a.md`;
    const map = buildSkeleton(
      input({ docs: [doc(path, ["date: 2026-10-20", "status: draft"], "A の spec")] }),
    );
    expect(map.phases).toEqual(DEFAULT_PHASES);
    expect(map.phases).not.toBe(DEFAULT_PHASES);
    expect(map).toMatchObject({
      themeId: "theme-1",
      workspaceRepo: REPO,
      workspaceProject: PROJECT,
      workspaceSha: SHA,
      rejected: [],
      appliedReviewIds: [],
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(map.tasks).toEqual([
      {
        id: taskIdForKey(path),
        key: path,
        phaseId: PHASE_IDS.select,
        order: 0,
        title: "A の spec",
        purpose: "",
        status: "doing",
        statusSource: "record",
        statusRaw: "draft",
        sources: [
          {
            kind: "spec",
            path,
            url: `https://github.com/${REPO}/blob/${SHA}/${path}`,
            label: "A の spec",
          },
        ],
        commitShas: [],
        reviewIds: [],
        origin: "ai",
        review: "unconfirmed",
      },
    ]);
    expect(map.links).toEqual([]);
  });

  it("kind でレーンを決める", () => {
    const docs = [
      doc(`${BS}/2026-10-01-b.md`, ["status: exploratory"]),
      doc(`${LAB}/papers/2026-10-01-p.md`, []),
      doc(`${LAB}/specs/2026-10-01-s.md`, ["status: draft"]),
      doc(`${LAB}/experiments/2026-10-01-e.md`, ["status: pass"]),
      doc(`${LAB}/meetings/2026-10-01-m.md`, []),
      doc(`${LAB}/materials/2026-10-01-t.md`, []),
    ];
    const map = buildSkeleton(input({ docs }));
    const phaseOf = (p: string) => taskOf(map, p).phaseId;
    expect(phaseOf(docs[0].path)).toBe(PHASE_IDS.research);
    expect(phaseOf(docs[1].path)).toBe(PHASE_IDS.research);
    expect(phaseOf(docs[2].path)).toBe(PHASE_IDS.select);
    expect(phaseOf(docs[3].path)).toBe(PHASE_IDS.verify);
    expect(phaseOf(docs[4].path)).toBe(PHASE_IDS.report);
    expect(phaseOf(docs[5].path)).toBe(PHASE_IDS.report);
  });
});

describe("buildSkeleton の状態", () => {
  const status = (docs: WorkspaceDoc[], path: string) =>
    taskOf(buildSkeleton(input({ docs })), path).status;

  it("brainstorm：spec に参照されていれば exploratory でも done、それ以外は doing", () => {
    const exploratory = doc(`${BS}/2026-10-01-a.md`, ["status: exploratory"]);
    const linked = doc(`${BS}/2026-10-02-b.md`, ["status: adopted"]);
    const lonely = doc(`${BS}/2026-10-03-c.md`, ["status: adopted"]);
    const linkedExploratory = doc(`${BS}/2026-10-04-d.md`, ["status: exploratory"]);
    const spec = doc(`${LAB}/specs/2026-10-05-s.md`, [
      "status: draft",
      "source_brainstorm: ../../../../secretary/notes/brainstorm/2026-10-02-b.md",
      "evidence: ../../../../secretary/notes/brainstorm/2026-10-04-d.md",
    ]);
    const docs = [exploratory, linked, lonely, linkedExploratory, spec];
    expect(status(docs, exploratory.path)).toBe("doing");
    expect(status(docs, linked.path)).toBe("done");
    expect(status(docs, lonely.path)).toBe("doing");
    expect(status(docs, linkedExploratory.path)).toBe("done");
  });

  it("paper と meeting は done", () => {
    const paper = doc(`${LAB}/papers/p.md`, ["status: reading"]);
    const meeting = doc(`${LAB}/meetings/2026-10-01-m.md`, []);
    expect(status([paper, meeting], paper.path)).toBe("done");
    expect(status([paper, meeting], meeting.path)).toBe("done");
  });

  it("spec：approved・implemented は done、draft は doing、それ以外は waiting", () => {
    const make = (name: string, fm: string[]) => doc(`${LAB}/specs/2026-10-01-${name}.md`, fm);
    const docs = [
      make("a", ["status: draft", "approval: approved"]),
      make("b", ["status: implemented"]),
      make("c", ["status: approved"]),
      make("d", ["status: draft"]),
      make("e", ["status: proposed"]),
      make("f", []),
    ];
    const result = buildSkeleton(input({ docs })).tasks;
    const by = (n: string) => result.find((t) => t.key!.endsWith(`-${n}.md`))!;
    expect(by("a").status).toBe("done");
    expect(by("b").status).toBe("done");
    expect(by("c").status).toBe("done");
    expect(by("d").status).toBe("doing");
    expect(by("e").status).toBe("waiting");
    expect(by("f").status).toBe("waiting");
    expect(by("f").statusRaw).toBeUndefined();
    expect(by("e").statusRaw).toBe("proposed");
  });

  it("experiment：pass・done・complete は done、not-run・pending は waiting、それ以外は doing", () => {
    const make = (name: string, s: string) =>
      doc(`${LAB}/experiments/2026-10-01-${name}.md`, [`status: ${s}`]);
    const docs = [
      make("a", "pass"),
      make("b", "Done"),
      make("c", "complete"),
      make("d", "not-run"),
      make("e", "pending"),
      make("f", "running"),
      make("g", "cpu-pass-gpu-not-run"),
    ];
    const tasks = buildSkeleton(input({ docs })).tasks;
    const by = (n: string) => tasks.find((t) => t.key!.endsWith(`-${n}.md`))!;
    expect(["a", "b", "c"].map((n) => by(n).status)).toEqual(["done", "done", "done"]);
    expect(["d", "e"].map((n) => by(n).status)).toEqual(["waiting", "waiting"]);
    expect(by("f").status).toBe("doing");
    // pass を含んでいても not-run が付いていれば、実行の許可待ち
    expect(by("g").status).toBe("waiting");
    expect(by("g").statusRaw).toBe("cpu-pass-gpu-not-run");
  });

  it("material：同じ日付の meeting があれば done、無ければ doing", () => {
    const withMeeting = doc(`${LAB}/materials/2026-10-08-a.md`, ["status: draft"]);
    const withoutMeeting = doc(`${LAB}/materials/2026-10-09-b.md`, ["status: draft"]);
    const meeting = doc(`${LAB}/meetings/2026-10-08-mtg.md`, []);
    const docs = [withMeeting, withoutMeeting, meeting];
    expect(status(docs, withMeeting.path)).toBe("done");
    expect(status(docs, withoutMeeting.path)).toBe("doing");
    expect(status([withMeeting], withMeeting.path)).toBe("doing");
  });
});

describe("buildSkeleton のコミット", () => {
  const specPath = `${LAB}/specs/2026-10-20-s.md`;

  it("ドキュメントに（前方一致で）出てくるコミットは実装レーンの done のタスクになる", () => {
    const spec = doc(specPath, ["status: implemented", `implementation_reference_commit: ${sha("abc1234").slice(0, 10)}`]);
    const commits = [commit("abc1234", "2026-10-21T10:00:00Z", "feat: 追加\n\n本文"), commit("def5678", "2026-10-22T10:00:00Z")];
    const map = buildSkeleton(input({ docs: [spec], commits }));
    const task = taskOf(map, `commit:${sha("abc1234")}`);
    expect(task).toMatchObject({
      id: taskIdForKey(`commit:${sha("abc1234")}`),
      phaseId: PHASE_IDS.implement,
      title: "feat: 追加",
      purpose: "",
      status: "done",
      statusSource: "record",
      commitShas: [sha("abc1234")],
      origin: "ai",
      review: "unconfirmed",
    });
    expect(task.flag).toBeUndefined();
    expect(task.sources).toEqual([
      {
        kind: "commit",
        path: sha("abc1234"),
        url: `https://github.com/example-org/impl/commit/${sha("abc1234")}`,
        label: "abc1234",
      },
    ]);
    // 記録の無いコミットは unrecorded
    expect(taskOf(map, `commit:${sha("def5678")}`).flag).toBe("unrecorded");
  });

  it("記録の無いコミットは新しい10件まで", () => {
    const commits = Array.from({ length: 13 }, (_, i) =>
      commit(`a${i.toString(16).padStart(2, "0")}1234`, `2026-10-${String(10 + i).padStart(2, "0")}T00:00:00Z`),
    );
    const map = buildSkeleton(input({ commits }));
    const keys = map.tasks.map((t) => t.key);
    expect(map.tasks).toHaveLength(10);
    expect(map.tasks.every((t) => t.flag === "unrecorded")).toBe(true);
    // 新しい3件（i = 12, 11, 10）が先頭、古い3件（i = 0, 1, 2）は入らない
    expect(keys[0]).toBe(`commit:${commits[12].sha}`);
    expect(keys).not.toContain(`commit:${commits[0].sha}`);
    expect(keys).not.toContain(`commit:${commits[2].sha}`);
    expect(keys).toContain(`commit:${commits[3].sha}`);
  });

  it("記録のあるコミットは10件に数えない", () => {
    const docs = [doc(specPath, ["status: draft", "base_commit: " + sha("111aaaa").slice(0, 8)])];
    const commits = [
      ...Array.from({ length: 10 }, (_, i) => commit(`b${i}1234`, `2026-10-${String(11 + i).padStart(2, "0")}T00:00:00Z`)),
      commit("111aaaa", "2026-10-01T00:00:00Z"),
    ];
    const map = buildSkeleton(input({ docs, commits }));
    const implement = map.tasks.filter((t) => t.phaseId === PHASE_IDS.implement);
    expect(implement).toHaveLength(11);
    expect(implement.filter((t) => t.flag === "unrecorded")).toHaveLength(10);
    expect(taskOf(map, `commit:${sha("111aaaa")}`).flag).toBeUndefined();
  });

  it("ドキュメントに出てくる SHA が実装の一覧に無ければ、タスクは作らない", () => {
    const docs = [doc(specPath, ["status: draft", "base_commit: 9999999"])];
    expect(buildSkeleton(input({ docs })).tasks).toHaveLength(1);
  });
});

describe("buildSkeleton の flow リンク", () => {
  const bsPath = `${BS}/2026-10-19-idea.md`;
  const specPath = `${LAB}/specs/2026-10-20-s.md`;
  const expPath = `${LAB}/experiments/2026-10-21-e.md`;
  const bsRel = "../../../../secretary/notes/brainstorm/2026-10-19-idea.md";

  function build(specFm: string[], expFm: string[]) {
    const docs = [
      doc(bsPath, ["status: adopted"]),
      doc(specPath, ["status: implemented", `source_brainstorm: ${bsRel}`, `implementation_reference_commit: ${sha("aaa1111")}`, ...specFm]),
      doc(expPath, ["status: pass", `base_commit: ${sha("bbb2222")}`, ...expFm]),
    ];
    const commits = [commit("aaa1111", "2026-10-22T00:00:00Z"), commit("bbb2222", "2026-10-23T00:00:00Z")];
    const map = buildSkeleton(input({ docs, commits }));
    const id = (key: string) => taskOf(map, key).id;
    const edges = map.links.map((l) => [l.fromTaskId, l.toTaskId, l.kind]);
    return { map, id, edges };
  }

  it("壁打ち → spec、spec → 実験（実験が spec を指す）、spec → コミット、コミット → 実験", () => {
    const { id, edges, map } = build([], [`spec: ../specs/2026-10-20-s.md`]);
    expect(edges).toHaveLength(4);
    expect(edges).toContainEqual([id(bsPath), id(specPath), "flow"]);
    expect(edges).toContainEqual([id(specPath), id(expPath), "flow"]);
    expect(edges).toContainEqual([id(specPath), id(`commit:${sha("aaa1111")}`), "flow"]);
    expect(edges).toContainEqual([id(`commit:${sha("bbb2222")}`), id(expPath), "flow"]);
    expect(new Set(map.links.map((l) => l.id)).size).toBe(4);
  });

  it("spec が実験を指すだけでも spec → 実験になる。両方が指しても1本", () => {
    const only = build([`implementation_verification: ../experiments/2026-10-21-e.md`], []);
    expect(only.edges).toContainEqual([only.id(specPath), only.id(expPath), "flow"]);
    const both = build(
      [`implementation_verification: ../experiments/2026-10-21-e.md`],
      [`spec: ../specs/2026-10-20-s.md`],
    );
    expect(both.edges.filter((e) => e[0] === both.id(specPath) && e[1] === both.id(expPath))).toHaveLength(1);
  });

  it("互いを指していなければ、spec と実験はつながない。向きは逆にならない", () => {
    const { id, edges } = build([], []);
    expect(edges).not.toContainEqual([id(specPath), id(expPath), "flow"]);
    expect(edges).not.toContainEqual([id(expPath), id(specPath), "flow"]);
    expect(edges).not.toContainEqual([id(specPath), id(bsPath), "flow"]);
  });

  it("リンク先のドキュメントが無ければ作らない。id は作り直しても同じ", () => {
    const specOnly = doc(specPath, ["status: draft", `source_brainstorm: ${bsRel}`]);
    expect(buildSkeleton(input({ docs: [specOnly] })).links).toEqual([]);
    const a = build([], [`spec: ../specs/2026-10-20-s.md`]).map.links.map((l) => l.id);
    const b = build([], [`spec: ../specs/2026-10-20-s.md`]).map.links.map((l) => l.id);
    expect(a).toEqual(b);
  });
});

describe("buildSkeleton の並び順（order）", () => {
  it("同じレーンの中で日付の新しい順。日付の無いものは最後。レーンごとに0から", () => {
    const docs = [
      doc(`${LAB}/experiments/2026-10-01-old.md`, ["status: pass"]),
      doc(`${LAB}/experiments/2026-10-20-new.md`, ["status: pass"]),
      doc(`${LAB}/experiments/undated.md`, ["status: pass"]),
      doc(`${LAB}/experiments/2026-10-10-mid.md`, ["status: pass"]),
      doc(`${LAB}/specs/2026-10-05-s.md`, ["status: draft"]),
    ];
    const map = buildSkeleton(input({ docs }));
    const verify = map.tasks.filter((t) => t.phaseId === PHASE_IDS.verify);
    expect(verify.map((t) => [t.key!.split("/").pop(), t.order])).toEqual([
      ["2026-10-20-new.md", 0],
      ["2026-10-10-mid.md", 1],
      ["2026-10-01-old.md", 2],
      ["undated.md", 3],
    ]);
    expect(map.tasks.find((t) => t.phaseId === PHASE_IDS.select)!.order).toBe(0);
  });

  it("実装レーンはコミットの日時の新しい順（記録のあるものも無いものも一緒に）", () => {
    const docs = [doc(`${LAB}/specs/2026-10-20-s.md`, ["status: draft", `base_commit: ${sha("d0d0001")}`])];
    const commits = [
      commit("face001", "2026-10-23T09:00:00Z"),
      commit("d0d0001", "2026-10-22T09:00:00Z"),
      commit("01d0001", "2026-10-21T09:00:00Z"),
    ];
    const map = buildSkeleton(input({ docs, commits }));
    const implement = map.tasks.filter((t) => t.phaseId === PHASE_IDS.implement);
    expect(implement.map((t) => [t.commitShas[0].slice(0, 7), t.order])).toEqual([
      ["face001", 0],
      ["d0d0001", 1],
      ["01d0001", 2],
    ]);
  });

  it("tasks はレーンの順、レーンの中は order 順に並ぶ", () => {
    const docs = [
      doc(`${LAB}/materials/2026-10-01-m.md`, []),
      doc(`${LAB}/specs/2026-10-01-s.md`, ["status: draft"]),
      doc(`${BS}/2026-10-01-b.md`, []),
    ];
    const map = buildSkeleton(input({ docs }));
    expect(map.tasks.map((t) => t.phaseId)).toEqual([PHASE_IDS.research, PHASE_IDS.select, PHASE_IDS.report]);
  });
});

describe("buildSkeleton のマイルストーン・重複", () => {
  it("マイルストーンは id を付けて渡す。同じタイトルは1つ", () => {
    const milestones = parseMilestones(
      "# R\n## マイルストーン\n- [x] ローダ\n- [ ] 学習\n- [ ] 学習\n",
    );
    const map = buildSkeleton(input({ milestones }));
    expect(map.milestones).toHaveLength(2);
    expect(map.milestones[0]).toMatchObject({ title: "ローダ", done: true });
    expect(map.milestones[0].id).toMatch(/^ms-/);
    expect(map.milestones[0].id).not.toBe(map.milestones[1].id);
    const again = buildSkeleton(input({ milestones }));
    expect(again.milestones).toEqual(map.milestones);
  });

  it("同じパスのドキュメントは1つだけ使う", () => {
    const d = doc(`${LAB}/specs/2026-10-01-s.md`, ["status: draft"]);
    expect(buildSkeleton(input({ docs: [d, d] })).tasks).toHaveLength(1);
  });
});
