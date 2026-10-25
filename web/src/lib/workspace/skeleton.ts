// research-workspace のドキュメントと実装リポジトリのコミットから、作業フローマップの骨格を作る（F-15）。
// AI を使わず、frontmatter のリンクと状態だけで決める。目的（purpose）は空にし、AI（lib/llm/map.ts）が後で埋める。
// 副作用のない関数だけを置く。
// 【担当：サブエージェント A。シグネチャはルート（B）・AI（C）・差分（D1）が使うので変えない】

import type {
  MapLink,
  MapMilestone,
  MapPhase,
  MapSource,
  MapStatus,
  MapTask,
  WorkflowMap,
} from "@/lib/types";
import type { ParsedMilestone, WorkspaceDoc } from "./parse";

export type ImplCommit = {
  sha: string; // 40桁
  message: string;
  url: string;
  date: string; // ISO 8601
};

// レーンは5つで固定（人が後から足せる）。id は作り直しても変わらない
export const PHASE_IDS = {
  research: "phase-research",
  select: "phase-select",
  implement: "phase-implement",
  verify: "phase-verify",
  report: "phase-report",
} as const;

export const DEFAULT_PHASES: MapPhase[] = [
  { id: PHASE_IDS.research, name: "調査", order: 0, kinds: ["brainstorm", "paper"] },
  { id: PHASE_IDS.select, name: "選定", order: 1, kinds: ["spec"] },
  { id: PHASE_IDS.implement, name: "実装", order: 2, kinds: ["commit"] },
  { id: PHASE_IDS.verify, name: "検証", order: 3, kinds: ["experiment"] },
  { id: PHASE_IDS.report, name: "報告", order: 4, kinds: ["material", "meeting"] },
];

// key から、作り直しても変わらないタスクの id を作る（同じ key なら同じ id）。例："wm-" + key のハッシュ
//
// この実装で決めたこと：53ビットの文字列ハッシュ（cyrb53）を36進数にしたもの。リンクとマイルストーンの id も同じハッシュで作る
export function taskIdForKey(key: string): string {
  return `wm-${hashString(key)}`;
}

function hashString(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type SkeletonInput = {
  themeId: string;
  workspaceRepo: string;
  workspaceProject: string;
  workspaceSha: string;
  docs: WorkspaceDoc[];
  milestones: ParsedMilestone[]; // 部分的な更新（変わったファイルだけ）のときは空でよい
  commits: ImplCommit[]; // 実装リポジトリの最近のコミット（新しい順）
  now: string; // ISO 8601
};

// 骨格を作る。規則：
// - タスクはドキュメント1つにつき1つ（親を持たない）。key はパス、id は taskIdForKey(key)。レーンは kind で決める
// - title は doc.title、purpose は ""（AI が埋める）、origin "ai"、review "unconfirmed"、statusSource "record"、statusRaw は元の status
// - 状態：brainstorm は、どれかの spec の links に入っていれば done（結論が spec になった）、それ以外は doing。
//   paper は done。spec は approval が approved か status が implemented / approved なら done、draft なら doing、それ以外は waiting。
//   experiment は status に pass・done・complete を含めば done、not-run・pending を含めば waiting、それ以外は doing。
//   meeting は done。material は同じ日付の meeting があれば done、無ければ doing
// - sources：そのドキュメント（kind、path、url は https://github.com/<workspaceRepo>/blob/<workspaceSha>/<path>、label はタイトル）
// - コミット：ドキュメントの commits に（前方一致で）出てくる実装のコミットは、実装レーンのタスク（key "commit:<sha>"、
//   title はメッセージの1行目、done、commitShas に sha、sources に kind "commit"・url）。
//   どのドキュメントにも出てこないコミットのうち新しい10件は、flag "unrecorded" のタスクにする
// - flow リンク（id は "link:" + from の key + "->" + to の key のハッシュなど、作り直しても変わるないもの）：
//   壁打ち → spec（spec の links に壁打ちのパス）、spec → 実験（spec か実験の links で互いを指す）、
//   spec → コミット（spec の commits）、コミット → 実験（実験の commits）
// - マイルストーン：milestones から（id は "ms-" + タイトルのハッシュ）。タスクへの付け方は AI が決める
// - order：同じレーンの中で、日付の新しい順に 0, 1, 2...
// - rejected・appliedReviewIds は空。workspaceRepo・workspaceProject・workspaceSha・createdAt・updatedAt を入れる
//
// この実装で決めたこと：
// - 実験の状態は、not-run・pending を先に見る（"cpu-pass-gpu-not-run" は、pass を含んでいても GPU が未実施なので waiting）。
//   大文字小文字と区切り（- _ 空白）の違いは無視する
// - brainstorm は、spec から参照されていれば status が exploratory でも done（研究ワークスペースでは、spec を作ったあとも
//   壁打ちの status が exploratory のまま残ることが多く、そのままでは調査レーンが全部「比較中」になるため）
// - material の「同じ日付」は日付の先頭10文字（YYYY-MM-DD）で比べる
// - コミットのタスクの status は done、statusRaw は付けない。sources の label は短い SHA（7桁）
// - ドキュメントのタスクの commitShas は空（コミットは実装レーンのタスクに付ける）
// - 同じ日付・日付が無いタスクは、渡された順を保つ。日付の無いものはレーンの最後
// - 同じパスのドキュメントは最初の1つだけ使う。kind が commit・todo のものと、レーンが見つからない kind は使わない
// - 「新しい10件」は commits の date の新しい順（同じ日時は渡された順）で数える
// - flow リンクは、両端のタスクがあるものだけ。同じ組は1本
// - tasks は、レーンの order 順、レーンの中は order 順に並べる
export function buildSkeleton(input: SkeletonInput): WorkflowMap {
  const { workspaceRepo, workspaceSha, now } = input;

  const seenPaths = new Set<string>();
  const docs = input.docs.filter((doc) => {
    if (seenPaths.has(doc.path) || !phaseForKind(doc.kind)) return false;
    seenPaths.add(doc.path);
    return true;
  });

  // 状態を決めるための索引
  const linkedBrainstorms = new Set<string>();
  const meetingDates = new Set<string>();
  for (const doc of docs) {
    if (doc.kind === "spec") for (const l of doc.links) linkedBrainstorms.add(l);
    if (doc.kind === "meeting" && doc.date) meetingDates.add(doc.date.slice(0, 10));
  }

  type Entry = { task: MapTask; time: number; index: number };
  const entries: Entry[] = [];
  const taskByKey = new Map<string, MapTask>();
  const addEntry = (task: MapTask, time: number) => {
    entries.push({ task, time, index: entries.length });
    taskByKey.set(task.key!, task);
  };

  for (const doc of docs) {
    const phase = phaseForKind(doc.kind)!;
    const source: MapSource = {
      kind: doc.kind,
      path: doc.path,
      url: docUrl(workspaceRepo, workspaceSha, doc.path),
      label: doc.title,
    };
    addEntry(
      {
        id: taskIdForKey(doc.path),
        key: doc.path,
        phaseId: phase.id,
        order: 0,
        title: doc.title,
        purpose: "",
        status: docStatus(doc, linkedBrainstorms, meetingDates),
        statusSource: "record",
        ...(doc.status ? { statusRaw: doc.status } : {}),
        sources: [source],
        commitShas: [],
        reviewIds: [],
        origin: "ai",
        review: "unconfirmed",
      },
      Date.parse(doc.date ?? ""),
    );
  }

  // コミット：ドキュメントに出てくるもの（前方一致）と、出てこない新しい10件
  const commits = uniqueBy(input.commits, (c) => c.sha.toLowerCase());
  const docShas = docs.flatMap((d) => d.commits);
  const isRecorded = (c: ImplCommit) => docShas.some((s) => c.sha.toLowerCase().startsWith(s));
  const recorded = commits.filter(isRecorded);
  const unrecorded = sortNewestFirst(commits.filter((c) => !isRecorded(c))).slice(0, MAX_UNRECORDED);
  const implementPhase = phaseForKind("commit");
  if (implementPhase) {
    const targets = [
      ...recorded.map((commit) => ({ commit, unrecorded: false })),
      ...unrecorded.map((commit) => ({ commit, unrecorded: true })),
    ];
    for (const { commit, unrecorded: flagged } of targets) {
      const sha = commit.sha.toLowerCase();
      addEntry(
        {
          id: taskIdForKey(`commit:${sha}`),
          key: `commit:${sha}`,
          phaseId: implementPhase.id,
          order: 0,
          title: firstLine(commit.message) || sha.slice(0, 7),
          purpose: "",
          status: "done",
          statusSource: "record",
          sources: [{ kind: "commit", path: sha, url: commit.url, label: sha.slice(0, 7) }],
          commitShas: [sha],
          reviewIds: [],
          ...(flagged ? { flag: "unrecorded" as const } : {}),
          origin: "ai",
          review: "unconfirmed",
        },
        Date.parse(commit.date),
      );
    }
  }

  // order：レーンの中で日付の新しい順（日付の無いものは最後）
  const phases: MapPhase[] = DEFAULT_PHASES.map((p) => ({ ...p, kinds: [...p.kinds] }));
  for (const phase of phases) {
    const lane = entries
      .filter((e) => e.task.phaseId === phase.id)
      .sort((a, b) => compareNewestFirst(a.time, b.time) || a.index - b.index);
    lane.forEach((e, i) => {
      e.task.order = i;
    });
  }
  const phaseOrder = new Map(phases.map((p) => [p.id, p.order]));
  const tasks = entries
    .map((e) => e.task)
    .sort(
      (a, b) =>
        (phaseOrder.get(a.phaseId) ?? 0) - (phaseOrder.get(b.phaseId) ?? 0) || a.order - b.order,
    );

  // flow リンク
  const links: MapLink[] = [];
  const linkIds = new Set<string>();
  const addLink = (fromKey: string, toKey: string) => {
    const from = taskByKey.get(fromKey);
    const to = taskByKey.get(toKey);
    if (!from || !to || from === to) return;
    const id = `wl-${hashString(`link:${fromKey}->${toKey}`)}`;
    if (linkIds.has(id)) return;
    linkIds.add(id);
    links.push({ id, fromTaskId: from.id, toTaskId: to.id, kind: "flow" });
  };
  const commitKeysOf = (doc: WorkspaceDoc) =>
    commits
      .filter((c) => doc.commits.some((s) => c.sha.toLowerCase().startsWith(s)))
      .map((c) => `commit:${c.sha.toLowerCase()}`);
  const docsOf = (kind: WorkspaceDoc["kind"]) => docs.filter((d) => d.kind === kind);
  const brainstormPaths = new Set(docsOf("brainstorm").map((d) => d.path));
  for (const spec of docsOf("spec")) {
    for (const path of spec.links) if (brainstormPaths.has(path)) addLink(path, spec.path);
    for (const exp of docsOf("experiment")) {
      if (spec.links.includes(exp.path) || exp.links.includes(spec.path)) {
        addLink(spec.path, exp.path);
      }
    }
    for (const key of commitKeysOf(spec)) addLink(spec.path, key);
  }
  for (const exp of docsOf("experiment")) {
    for (const key of commitKeysOf(exp)) addLink(key, exp.path);
  }

  const milestones: MapMilestone[] = uniqueBy(
    input.milestones.map((m) => ({ id: `ms-${hashString(m.title)}`, title: m.title, done: m.done })),
    (m) => m.id,
  );

  return {
    themeId: input.themeId,
    workspaceRepo,
    workspaceProject: input.workspaceProject,
    workspaceSha,
    phases,
    milestones,
    tasks,
    links,
    rejected: [],
    appliedReviewIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

// 実装レーンに置く「記録の無いコミット」の上限
const MAX_UNRECORDED = 10;

function phaseForKind(kind: WorkspaceDoc["kind"]): MapPhase | undefined {
  return DEFAULT_PHASES.find((p) => p.kinds.includes(kind));
}

function docUrl(repo: string, sha: string, path: string): string {
  return `https://github.com/${repo}/blob/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function firstLine(message: string): string {
  return message.split(/\r?\n/)[0].trim();
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = keyOf(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// 時刻の新しい順に並べる比較。読めない時刻（NaN）は最後
function compareNewestFirst(a: number, b: number): number {
  const an = Number.isNaN(a);
  const bn = Number.isNaN(b);
  if (an !== bn) return an ? 1 : -1;
  return an ? 0 : b - a;
}

function sortNewestFirst(commits: ImplCommit[]): ImplCommit[] {
  return commits
    .map((c, index) => ({ c, index, time: Date.parse(c.date) }))
    .sort((a, b) => compareNewestFirst(a.time, b.time) || a.index - b.index)
    .map((x) => x.c);
}

function normalizeStatus(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function docStatus(
  doc: WorkspaceDoc,
  linkedBrainstorms: Set<string>,
  meetingDates: Set<string>,
): MapStatus {
  const status = normalizeStatus(doc.status);
  switch (doc.kind) {
    case "brainstorm":
      return linkedBrainstorms.has(doc.path) ? "done" : "doing";
    case "paper":
    case "meeting":
      return "done";
    case "spec":
      if (
        normalizeStatus(doc.approval) === "approved" ||
        status === "implemented" ||
        status === "approved"
      ) {
        return "done";
      }
      return status === "draft" ? "doing" : "waiting";
    case "experiment":
      if (status.includes("not-run") || status.includes("pending")) return "waiting";
      if (["pass", "done", "complete"].some((w) => status.includes(w))) return "done";
      return "doing";
    case "material":
      return doc.date && meetingDates.has(doc.date.slice(0, 10)) ? "done" : "doing";
    default:
      return "doing";
  }
}
