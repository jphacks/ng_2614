// デモモード（F-12）で使う、作業フローマップ（F-15）のデモデータ。
// 題材は data.ts と同じ「DDPM のノイズスケジュール（cosine は linear より生成の質が上がるか）」。research-workspace の形式の、小さな架空のワークスペースから作ったマップ。
// 【担当：サブエージェント B。シグネチャは api-client.ts（親）が使うので変えない】

import type { MapGenerateRequest, MapUpdateRequest, MapUpdateResponse } from "@/lib/api-types";
import type {
  MapLink,
  MapMilestone,
  MapOp,
  MapPhase,
  MapSource,
  MapStatus,
  MapTask,
  WorkflowMap,
} from "@/lib/types";
import {
  CLIP_SUMMARY,
  DEMO_THEME_ID,
  MAIN_SHA,
  NORMALIZE_SUMMARY,
  demoCommits,
} from "./data";

// 架空のワークスペース（demo-lab/research-workspace）
const WORKSPACE_REPO = "demo-lab/research-workspace";
const WORKSPACE_PROJECT = ".research/lab/projects/ddpm-noise-schedule";
const WORKSPACE_SHA_BEFORE = "e41b7d09c3a85f2e6b1d4c7a9f0e3b5d8c2a6f14";
const WORKSPACE_SHA_AFTER = "7c2e9a4f1b6d03e85a7c9b2d4f6e1a3c5b8d0e97";

const WS = WORKSPACE_PROJECT;
const BRAINSTORM_PATH = ".research/secretary/notes/brainstorm/2026-10-20-schedule-candidates.md";
const PAPER_PATH = ".research/secretary/notes/papers/2026-10-20-improved-ddpm.md";
const METRIC_BRAINSTORM_PATH = ".research/secretary/notes/brainstorm/2026-10-21-metric.md";
const SPEC_PATH = `${WS}/specs/2026-10-21-schedule-comparison-spec.md`;
const METRIC_SPEC_PATH = `${WS}/specs/2026-10-23-metric-spec.md`;
const MEETING_PATH = `${WS}/meetings/2026-10-22-seminar.md`;
const MATERIAL_PATH = `${WS}/materials/2026-10-midterm-report.md`;
const EXPERIMENT_PATH = `${WS}/experiments/2026-10-24-seed-comparison.md`;

// ---- ID ----

const PHASE = {
  research: "demo-phase-research",
  select: "demo-phase-select",
  implement: "demo-phase-implement",
  verify: "demo-phase-verify",
  report: "demo-phase-report",
} as const;

const MILESTONE = {
  compare: "demo-milestone-compare",
  metric: "demo-milestone-metric",
  seminar: "demo-milestone-seminar",
} as const;

const TASK = {
  candidates: "demo-task-r1",
  metrics: "demo-task-r2",
  stable: "demo-task-r3",
  stableNormalize: "demo-task-r3-normalize",
  stableClip: "demo-task-r3-clip",
  specCompare: "demo-task-s1",
  specCompareB2: "demo-task-s1-b2",
  specCompareB3: "demo-task-s1-b3",
  specMetric: "demo-task-s2",
  script: "demo-task-i1",
  seeds: "demo-task-v1",
  seminar: "demo-task-m1",
  midterm: "demo-task-m2",
} as const;

// ---- 場面1：取り込み前のマップ ----

type TaskInput = {
  id: string;
  phaseId: string;
  parentId?: string;
  milestoneId?: string;
  order: number;
  title: string;
  purpose: string;
  status: MapStatus;
  statusSource?: "record" | "ai";
  statusRaw?: string;
  result?: string;
  rejectReason?: string;
  sources?: MapSource[];
};

function task(input: TaskInput): MapTask {
  return {
    id: input.id,
    phaseId: input.phaseId,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
    order: input.order,
    title: input.title,
    purpose: input.purpose,
    status: input.status,
    statusSource: input.statusSource ?? "record",
    ...(input.statusRaw ? { statusRaw: input.statusRaw } : {}),
    ...(input.result ? { result: input.result } : {}),
    ...(input.rejectReason ? { rejectReason: input.rejectReason } : {}),
    sources: input.sources ?? [],
    commitShas: [],
    reviewIds: [],
    origin: "ai",
    review: "unconfirmed",
  };
}

function flow(id: string, fromTaskId: string, toTaskId: string, reason: string): MapLink {
  return { id, fromTaskId, toTaskId, kind: "flow", reason };
}

const PHASES: MapPhase[] = [
  { id: PHASE.research, name: "調査", order: 0, kinds: ["brainstorm", "paper"] },
  { id: PHASE.select, name: "選定", order: 1, kinds: ["spec"] },
  { id: PHASE.implement, name: "実装", order: 2, kinds: ["commit"] },
  { id: PHASE.verify, name: "検証", order: 3, kinds: ["experiment"] },
  { id: PHASE.report, name: "報告", order: 4, kinds: ["material", "meeting"] },
];

const MILESTONES: MapMilestone[] = [
  { id: MILESTONE.compare, title: "linear と cosine を同じ条件で比べる", done: false },
  { id: MILESTONE.metric, title: "評価指標を決める", done: false },
  { id: MILESTONE.seminar, title: "ゼミで中間報告する", done: false },
];

function demoTasks(): MapTask[] {
  const m1 = MILESTONE.compare;
  const m2 = MILESTONE.metric;
  const m3 = MILESTONE.seminar;
  const brainstorm: MapSource = {
    kind: "brainstorm",
    path: BRAINSTORM_PATH,
    label: "スケジュールの候補の壁打ち",
  };
  const paper: MapSource = { kind: "paper", path: PAPER_PATH, label: "Improved DDPM の論文メモ" };
  const metricBrainstorm: MapSource = {
    kind: "brainstorm",
    path: METRIC_BRAINSTORM_PATH,
    label: "評価指標の壁打ち",
  };
  const spec: MapSource = { kind: "spec", path: SPEC_PATH, label: "比較実験の spec" };
  const metricSpec: MapSource = { kind: "spec", path: METRIC_SPEC_PATH, label: "評価指標の spec" };
  const meeting: MapSource = { kind: "meeting", path: MEETING_PATH, label: "10/22 ゼミの記録" };

  return [
    // 調査
    task({
      id: TASK.candidates,
      phaseId: PHASE.research,
      milestoneId: m1,
      order: 0,
      title: "比べるノイズスケジュールの候補を洗い出す",
      purpose: "「cosine は linear より生成の質が上がるか」を問うために、何と何を比べるかを決める。",
      status: "done",
      result: "linear と cosine の2つに絞った",
      sources: [brainstorm, paper],
    }),
    task({
      id: "demo-task-r1-linear",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 0,
      title: "linear（β を 1e-4 から 0.02 まで線形）",
      purpose: "cosine が上回ったと言うための、比べる相手（ベースライン）を決める。",
      status: "done",
      sources: [brainstorm],
    }),
    task({
      id: "demo-task-r1-cosine",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 1,
      title: "cosine（Nichol & Dhariwal, 2021）",
      purpose: "研究の問いで linear より良いかを確かめたい提案側を、候補として押さえる。",
      status: "done",
      sources: [brainstorm, paper],
    }),
    task({
      id: "demo-task-r1-sigmoid",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 2,
      title: "sigmoid スケジュールも比べる",
      purpose: "第3の候補として検討したが、研究の問いに答える比較には含めないと決めた。",
      status: "rejected",
      statusSource: "ai",
      rejectReason: "3つ以上で比べると差の原因を切り分けにくく、問いは linear との比較だけで答えられる",
      sources: [brainstorm],
    }),
    task({
      id: TASK.metrics,
      phaseId: PHASE.research,
      milestoneId: m2,
      order: 1,
      title: "評価指標の検討",
      purpose: "どの数字で「生成の質が上がった」と言うかを決めないと、比較の結論が出せない。",
      status: "done",
      result: "sliced Wasserstein 距離を使う方向",
      sources: [metricBrainstorm],
    }),
    task({
      id: "demo-task-r2-sw",
      phaseId: PHASE.research,
      parentId: TASK.metrics,
      milestoneId: m2,
      order: 0,
      title: "sliced Wasserstein 距離",
      purpose: "生成した点と本物の点に1対1の対応が無くても、点の集まりどうしの近さを1つの数で測れる指標にする。",
      status: "done",
      sources: [metricBrainstorm],
    }),
    task({
      id: "demo-task-r2-fid",
      phaseId: PHASE.research,
      parentId: TASK.metrics,
      milestoneId: m2,
      order: 1,
      title: "FID・IS だけで評価する",
      purpose: "画像の生成でよく使われる指標として検討したが、このデータでは生成の質を測れない。",
      status: "rejected",
      statusSource: "ai",
      rejectReason: "画像用の分類器が前提で、2次元のトイデータ（swiss roll）には使えない",
      sources: [metricBrainstorm],
    }),
    task({
      id: TASK.stable,
      phaseId: PHASE.research,
      milestoneId: m1,
      order: 2,
      title: "学習とサンプリングを安定させる方法を調べる",
      purpose:
        "安定させる方法で比較の結果が変わりうるので、linear と cosine を公平に比べられる扱い方を決める。",
      status: "doing",
      statusRaw: "exploratory",
      sources: [brainstorm],
    }),
    task({
      id: TASK.stableNormalize,
      phaseId: PHASE.research,
      parentId: TASK.stable,
      milestoneId: m1,
      order: 0,
      title: "データを正規化する",
      purpose: "学習が発散しにくくなるが、評価に使う値のスケールが変わらないかを確かめる。",
      status: "todo",
      statusSource: "ai", // 記録に無い案。取り込みで AI が「比較中」と推測するので、記録の状態としては扱わない
    }),
    task({
      id: TASK.stableClip,
      phaseId: PHASE.research,
      parentId: TASK.stable,
      milestoneId: m1,
      order: 1,
      title: "cosine の β に上限を付ける",
      purpose: "サンプルの飛び散りを抑えられるが、比べているのが論文の cosine のままかを確かめる。",
      status: "todo",
      statusSource: "ai", // 記録に無い案（上の「正規化する」と同じ）
    }),
    task({
      id: "demo-task-r3-lr",
      phaseId: PHASE.research,
      parentId: TASK.stable,
      milestoneId: m1,
      order: 2,
      title: "学習率を下げる",
      purpose: "スケジュールの条件を変えずに、学習を安定させられるかを確かめる。",
      status: "todo",
    }),

    // 選定
    task({
      id: TASK.specCompare,
      phaseId: PHASE.select,
      milestoneId: m1,
      order: 0,
      title: "比較実験の spec",
      purpose: "2つのスケジュールを同じ条件で比べるための実験の約束事を決める。",
      status: "done",
      statusRaw: "approved",
      sources: [spec],
    }),
    task({
      id: "demo-task-s1-b1",
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 0,
      title: "B1 データ・モデル・T・学習の設定を両者で揃える",
      purpose: "スケジュール以外の差が結果に混ざらないよう、変えるのはスケジュールだけにする。",
      status: "done",
      sources: [spec],
    }),
    task({
      id: TASK.specCompareB2,
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 1,
      title: "B2 評価はデータの元のスケールのまま測る",
      purpose: "距離の値の意味をそろえ、前の結果や README の基準と比べられるようにする。",
      status: "done",
      sources: [spec],
    }),
    task({
      id: TASK.specCompareB3,
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 2,
      title: "B3 cosine は論文どおりの定義（β の上限 0.999）で使う",
      purpose: "比べているのが本来の cosine だと言えるようにし、結論を cosine そのものについて述べられるようにする。",
      status: "done",
      sources: [spec],
    }),
    task({
      id: TASK.specMetric,
      phaseId: PHASE.select,
      milestoneId: m2,
      order: 1,
      title: "評価指標の spec",
      purpose: "決めた評価指標を、何をどう報告するかの約束事として固める。",
      status: "doing",
      statusRaw: "draft",
      sources: [metricSpec],
    }),
    task({
      id: "demo-task-s2-report",
      phaseId: PHASE.select,
      parentId: TASK.specMetric,
      milestoneId: m2,
      order: 0,
      title: "seed 3 つの平均と標準偏差を報告する",
      purpose: "seed によるばらつきまで示し、linear と cosine の差が偶然ではないかを読めるようにする。",
      status: "doing",
      sources: [metricSpec],
    }),

    // 実装
    task({
      id: TASK.script,
      phaseId: PHASE.implement,
      milestoneId: m1,
      order: 0,
      title: "cosine スケジュールと比較スクリプト（ddpm.py・compare.py）",
      purpose: "spec の約束どおりに、linear と cosine を学習して sliced Wasserstein 距離を出すコードを用意する。",
      status: "todo",
      sources: [spec],
    }),

    // 検証
    task({
      id: TASK.seeds,
      phaseId: PHASE.verify,
      milestoneId: m1,
      order: 0,
      title: "seed 3 つで linear と cosine を比較する",
      purpose: "研究の問い「cosine は linear より生成の質が上がるか」に、数字で答える。",
      status: "waiting",
      statusRaw: "比較スクリプト待ち",
      sources: [{ kind: "experiment", path: EXPERIMENT_PATH, label: "seed 比較の実験記録" }],
    }),
    task({
      id: "demo-task-v1-linear",
      phaseId: PHASE.verify,
      parentId: TASK.seeds,
      milestoneId: m1,
      order: 0,
      title: "linear の sliced Wasserstein 距離（平均±標準偏差）",
      purpose: "比べる相手（ベースライン）の基準の数字を得る。",
      status: "todo",
    }),
    task({
      id: "demo-task-v1-cosine",
      phaseId: PHASE.verify,
      parentId: TASK.seeds,
      milestoneId: m1,
      order: 1,
      title: "cosine の sliced Wasserstein 距離（平均±標準偏差）",
      purpose: "提案側の数字を得て、linear より小さいか（質が上がったか）を判断する。",
      status: "todo",
    }),

    // 報告
    task({
      id: TASK.seminar,
      phaseId: PHASE.report,
      milestoneId: m3,
      order: 0,
      title: "10/22 ゼミ",
      purpose: "研究の進め方を先生に確かめ、指摘を次の作業に反映する。",
      status: "done",
      sources: [meeting],
    }),
    task({
      id: "demo-task-m1-metric",
      phaseId: PHASE.report,
      parentId: TASK.seminar,
      milestoneId: m3,
      order: 0,
      title: "評価は点の集まりどうしの距離で測る（先生の指摘）",
      purpose: "生成した点に1対1の対応が無いので、分布どうしの近さを測るよう言われた。評価指標の検討に戻す。",
      status: "done",
      sources: [meeting],
    }),
    task({
      id: TASK.midterm,
      phaseId: PHASE.report,
      milestoneId: m3,
      order: 1,
      title: "中間報告の資料",
      purpose: "比較の結果と、条件を揃えた根拠をゼミで説明できるようにまとめる。",
      status: "todo",
      sources: [{ kind: "material", path: MATERIAL_PATH, label: "中間報告の資料" }],
    }),
  ];
}

function demoLinks(): MapLink[] {
  return [
    flow(
      "demo-link-1",
      TASK.candidates,
      TASK.specCompare,
      "比べるスケジュールが決まったので、比較実験の約束事を決めた",
    ),
    flow(
      "demo-link-2",
      TASK.metrics,
      TASK.specMetric,
      "評価指標が決まったので、報告のしかたを spec にする",
    ),
    flow(
      "demo-link-3",
      TASK.specCompare,
      TASK.script,
      "承認された spec にもとづいて、cosine スケジュールと比較スクリプトを実装する",
    ),
    flow(
      "demo-link-4",
      TASK.script,
      TASK.seeds,
      "スクリプトができたら、seed 3 つの比較を実行する",
    ),
    flow(
      "demo-link-5",
      TASK.seminar,
      TASK.metrics,
      "ゼミでの先生の指摘が、評価指標の検討に戻った",
    ),
  ];
}

// 場面1：デモ用の研究テーマのマップ（変更を取り込む前の状態）を返す。
// デモ用でない研究テーマなら Error を投げる
export function demoWorkflowMap(req: MapGenerateRequest, now: string): WorkflowMap {
  if (req.themeId !== DEMO_THEME_ID) {
    throw new Error("デモの作業フローマップは、デモ用の研究テーマにだけあります");
  }
  return {
    themeId: req.themeId,
    workspaceRepo: WORKSPACE_REPO,
    workspaceProject: WORKSPACE_PROJECT,
    workspaceSha: WORKSPACE_SHA_BEFORE,
    phases: PHASES.map((p) => ({ ...p, kinds: [...p.kinds] })),
    milestones: MILESTONES.map((m) => ({ ...m })),
    tasks: demoTasks(),
    links: demoLinks(),
    rejected: [],
    appliedReviewIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---- 場面3：取り込んだ変更からの更新 ----

// 場面3：取り込んだ変更（判定）から、マップへの変更の一覧を返す。
// デモの cosine スケジュールと比較スクリプトのコミットなら見せ場の変更を返し、それ以外は空の一覧を返す
export function demoMapUpdate(req: MapUpdateRequest): MapUpdateResponse {
  const { review } = req;
  // review が無い（「ワークスペースから更新」）ときは、デモのワークスペースに変化が無いので何も変えない
  if (!review || review.commitSha !== MAIN_SHA) return { ops: [] };

  const shortSha = review.commitSha.slice(0, 7);
  const commit = demoCommits.find((c) => c.sha === review.commitSha);
  const commitSource: MapSource = {
    kind: "commit",
    path: review.commitSha,
    ...(commit ? { url: commit.url } : {}),
    label: `commit ${shortSha}`,
  };
  const normalize = review.findings.find((f) => f.summary === NORMALIZE_SUMMARY);
  const clip = review.findings.find((f) => f.summary === CLIP_SUMMARY);
  const extra = review.findings.some((f) => f.type === "extra_addition");

  const ops: MapOp[] = [
    {
      op: "update_task",
      taskId: TASK.script,
      status: "done",
      statusSource: "record",
      result: `コミット ${shortSha} で実装済み`,
      reason: "cosine スケジュールと比較スクリプトのコミットを取り込んだので、実装を完了にした",
    },
    {
      op: "add_task",
      tempId: "demo-temp-commit",
      phaseId: PHASE.implement,
      parentId: TASK.script,
      milestoneId: MILESTONE.compare,
      title: `commit ${shortSha} cosine スケジュールを追加して linear と比較`,
      purpose: "spec の比較実験を実行できるよう、linear と cosine を seed 3 つで学習して距離を出すコードを入れた。",
      status: "done",
      statusSource: "record",
      sources: [commitSource],
      commitShas: [review.commitSha],
      reviewIds: [review.id],
      reason: "取り込んだコミットを、実装「ddpm.py・compare.py」のサブタスクとして記録した",
    },
    {
      op: "link_task",
      taskId: TASK.script,
      commitShas: [review.commitSha],
      reviewIds: [review.id],
      reason: "このコミットと判定を、実装「ddpm.py・compare.py」に結び付けた",
    },
    ...(normalize
      ? [
          {
            op: "update_task",
            taskId: TASK.stableNormalize,
            status: "doing",
            statusSource: "ai",
            result: "AI が compare.py で採用（比較の途中のまま）",
            reason:
              "AI がデータを正規化して実装したため、比較中の「正規化する」案が、検討を経ずに採用された状態になった",
          } satisfies MapOp,
          {
            op: "add_link",
            fromTaskId: TASK.script,
            toTaskId: TASK.specCompareB2,
            kind: "impact",
            findingId: normalize.id,
            reason:
              "正規化した空間のまま距離を測っているので、B2「評価はデータの元のスケールのまま測る」の前提に影響する",
          } satisfies MapOp,
        ]
      : []),
    ...(clip
      ? [
          {
            op: "update_task",
            taskId: TASK.stableClip,
            status: "doing",
            statusSource: "ai",
            result: "AI が ddpm.py で採用（比較の途中のまま）",
            reason:
              "AI が β の上限を 0.02 にして実装したため、比較中の「上限を付ける」案が、検討を経ずに採用された状態になった",
          } satisfies MapOp,
          {
            op: "add_link",
            fromTaskId: TASK.script,
            toTaskId: TASK.specCompareB3,
            kind: "impact",
            findingId: clip.id,
            reason:
              "β の上限を 0.02 にしたので、B3「cosine は論文どおりの定義（上限 0.999）で使う」が満たされていない",
          } satisfies MapOp,
        ]
      : []),
    ...(extra
      ? [
          {
            op: "add_task",
            tempId: "demo-temp-extra",
            phaseId: PHASE.implement,
            title: "記録のない実装：散布図の保存と --quick オプション",
            purpose:
              "どの spec にも無いのに、samples.png の保存と学習ステップを減らす --quick が入った。--quick の結果を本番の比較と混ぜていないか確かめる必要がある。",
            status: "done",
            statusSource: "record",
            statusRaw: "どの spec にも無い",
            sources: [commitSource],
            commitShas: [review.commitSha],
            reviewIds: [review.id],
            flag: "unrecorded",
            reason: "頼んでいない散布図の保存と --quick がコミットに含まれていたが、記録のどこにも出てこないため",
          } satisfies MapOp,
        ]
      : []),
    {
      op: "update_task",
      taskId: TASK.seeds,
      status: "todo",
      statusSource: "record",
      statusRaw: "実行できる",
      reason: "比較スクリプトができたので、「比較スクリプト待ち」が解けた",
    },
  ];

  return { ops, workspaceSha: WORKSPACE_SHA_AFTER };
}
