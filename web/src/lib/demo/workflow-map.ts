// デモモード（F-12）で使う、作業フローマップ（F-15）のデモデータ。
// 題材は data.ts と同じ「健診データの疾患分類」。research-workspace の形式の、小さな架空のワークスペースから作ったマップ。
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
  CLASS_WEIGHT_SUMMARY,
  DEMO_THEME_ID,
  DROPNA_SUMMARY,
  MAIN_SHA,
  demoCommits,
} from "./data";

// 架空のワークスペース（demo-lab/research-workspace）
const WORKSPACE_REPO = "demo-lab/research-workspace";
const WORKSPACE_PROJECT = ".research/lab/projects/health-checkup-classification";
const WORKSPACE_SHA_BEFORE = "e41b7d09c3a85f2e6b1d4c7a9f0e3b5d8c2a6f14";
const WORKSPACE_SHA_AFTER = "7c2e9a4f1b6d03e85a7c9b2d4f6e1a3c5b8d0e97";

const WS = WORKSPACE_PROJECT;
const BRAINSTORM_PATH = ".research/secretary/notes/brainstorm/2026-10-20-model-candidates.md";
const PAPER_PATH = ".research/secretary/notes/papers/2026-10-20-lightgbm.md";
const METRIC_BRAINSTORM_PATH = ".research/secretary/notes/brainstorm/2026-10-21-metric.md";
const SPEC_PATH = `${WS}/specs/2026-10-21-model-comparison-spec.md`;
const METRIC_SPEC_PATH = `${WS}/specs/2026-10-23-metric-spec.md`;
const MEETING_PATH = `${WS}/meetings/2026-10-22-seminar.md`;
const MATERIAL_PATH = `${WS}/materials/2026-10-midterm-report.md`;
const EXPERIMENT_PATH = `${WS}/experiments/2026-10-24-cv-comparison.md`;

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
  missing: "demo-task-r3",
  missingDrop: "demo-task-r3-drop",
  specCompare: "demo-task-s1",
  specCompareB1: "demo-task-s1-b1",
  specCompareB3: "demo-task-s1-b3",
  specMetric: "demo-task-s2",
  trainPy: "demo-task-i1",
  cv: "demo-task-v1",
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
  { id: MILESTONE.compare, title: "LightGBM とロジスティック回帰を同じ条件で比べる", done: false },
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
    label: "手法の候補の壁打ち",
  };
  const paper: MapSource = { kind: "paper", path: PAPER_PATH, label: "LightGBM の論文メモ" };
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
      title: "比較する手法の候補を洗い出す",
      purpose: "「LightGBM はロジスティック回帰を上回るか」を問うために、何と何を比べるかを決める。",
      status: "done",
      result: "LightGBM とロジスティック回帰の2つに絞った",
      sources: [brainstorm, paper],
    }),
    task({
      id: "demo-task-r1-lgbm",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 0,
      title: "LightGBM（欠損値をそのまま扱える）",
      purpose: "研究の問いで上回るかを確かめたい提案手法を、候補として押さえる。",
      status: "done",
      sources: [brainstorm],
    }),
    task({
      id: "demo-task-r1-logreg",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 1,
      title: "ロジスティック回帰（ベースライン）",
      purpose: "LightGBM が上回ったと言うための、比べる相手（従来手法）を決める。",
      status: "done",
      sources: [brainstorm],
    }),
    task({
      id: "demo-task-r1-rf",
      phaseId: PHASE.research,
      parentId: TASK.candidates,
      milestoneId: m1,
      order: 2,
      title: "ランダムフォレスト",
      purpose: "第3の候補として検討したが、研究の問いに答える比較には含めないと決めた。",
      status: "rejected",
      statusSource: "ai",
      rejectReason: "LightGBM と性質が近く、比べても問いに答えにくい",
      sources: [brainstorm],
    }),
    task({
      id: TASK.metrics,
      phaseId: PHASE.research,
      milestoneId: m2,
      order: 1,
      title: "評価指標の検討",
      purpose: "どの数字で「上回った」と言うかを決めないと、比較の結論が出せない。",
      status: "done",
      result: "マクロ F1 を使う方向",
      sources: [metricBrainstorm],
    }),
    task({
      id: "demo-task-r2-f1",
      phaseId: PHASE.research,
      parentId: TASK.metrics,
      milestoneId: m2,
      order: 0,
      title: "マクロ F1",
      purpose: "陽性が少ないデータでも、陽性・陰性の両方の出来を同じ重みで見られる指標にする。",
      status: "done",
      sources: [metricBrainstorm],
    }),
    task({
      id: "demo-task-r2-acc",
      phaseId: PHASE.research,
      parentId: TASK.metrics,
      milestoneId: m2,
      order: 1,
      title: "正解率",
      purpose: "分かりやすい指標として検討したが、このデータでは手法の差を測れない。",
      status: "rejected",
      statusSource: "ai",
      rejectReason: "陽性が約12%なので、すべて陰性と予測しても約88%になる",
      sources: [metricBrainstorm],
    }),
    task({
      id: TASK.missing,
      phaseId: PHASE.research,
      milestoneId: m1,
      order: 2,
      title: "欠損値の扱いを調べる",
      purpose:
        "欠損値の扱いで比較の結果が変わりうるので、両手法を公平に比べられる扱い方を決める。",
      status: "doing",
      statusRaw: "exploratory",
      sources: [brainstorm],
    }),
    task({
      id: TASK.missingDrop,
      phaseId: PHASE.research,
      parentId: TASK.missing,
      milestoneId: m1,
      order: 0,
      title: "欠損のある行を除外する",
      purpose: "扱いが簡単だが、データ件数が減り、比べるデータそのものが変わらないかを確かめる。",
      status: "todo",
    }),
    task({
      id: "demo-task-r3-median",
      phaseId: PHASE.research,
      parentId: TASK.missing,
      milestoneId: m1,
      order: 1,
      title: "中央値で補完する",
      purpose: "データを減らさずに両手法へ同じデータを渡せるかを確かめる。",
      status: "todo",
    }),
    task({
      id: "demo-task-r3-keep",
      phaseId: PHASE.research,
      parentId: TASK.missing,
      milestoneId: m1,
      order: 2,
      title: "LightGBM には欠損のまま渡す",
      purpose: "LightGBM の強み（欠損をそのまま扱える）を生かすと、比較の条件がどう変わるかを確かめる。",
      status: "todo",
    }),

    // 選定
    task({
      id: TASK.specCompare,
      phaseId: PHASE.select,
      milestoneId: m1,
      order: 0,
      title: "比較実験の spec",
      purpose: "2つの手法を同じ条件で比べるための実験の約束事を決める。",
      status: "done",
      statusRaw: "approved",
      sources: [spec],
    }),
    task({
      id: TASK.specCompareB1,
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 0,
      title: "B1 前処理と特徴量を両手法で揃える",
      purpose: "手法以外の差が結果に混ざらないよう、入力のデータを同じにする。",
      status: "done",
      sources: [spec],
    }),
    task({
      id: "demo-task-s1-b2",
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 1,
      title: "B2 層化5分割・seed 42 で分割を揃える",
      purpose: "同じ分割で両手法を評価し、結果の差を分割のばらつきと区別できるようにする。",
      status: "done",
      sources: [spec],
    }),
    task({
      id: TASK.specCompareB3,
      phaseId: PHASE.select,
      parentId: TASK.specCompare,
      milestoneId: m1,
      order: 2,
      title: "B3 不均衡への対処を両手法で揃える",
      purpose: "陽性が約12%の不均衡への対処を片方にだけ入れず、手法の差だけを比べられるようにする。",
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
      title: "マクロ F1 の平均と標準偏差を報告する",
      purpose: "5分割の結果のばらつきまで示し、差が偶然ではないかを読めるようにする。",
      status: "doing",
      sources: [metricSpec],
    }),

    // 実装
    task({
      id: TASK.trainPy,
      phaseId: PHASE.implement,
      milestoneId: m1,
      order: 0,
      title: "学習・評価スクリプト（train.py）",
      purpose: "spec の約束どおりに、2つの手法を学習してマクロ F1 を出すコードを用意する。",
      status: "todo",
      sources: [spec],
    }),

    // 検証
    task({
      id: TASK.cv,
      phaseId: PHASE.verify,
      milestoneId: m1,
      order: 0,
      title: "5分割交差検証で比較する",
      purpose: "研究の問い「LightGBM はロジスティック回帰を上回るか」に、数字で答える。",
      status: "waiting",
      statusRaw: "学習スクリプト待ち",
      sources: [{ kind: "experiment", path: EXPERIMENT_PATH, label: "交差検証の実験記録" }],
    }),
    task({
      id: "demo-task-v1-logreg",
      phaseId: PHASE.verify,
      parentId: TASK.cv,
      milestoneId: m1,
      order: 0,
      title: "ロジスティック回帰のマクロ F1",
      purpose: "比べる相手（ベースライン）の基準の数字を得る。",
      status: "todo",
    }),
    task({
      id: "demo-task-v1-lgbm",
      phaseId: PHASE.verify,
      parentId: TASK.cv,
      milestoneId: m1,
      order: 1,
      title: "LightGBM のマクロ F1",
      purpose: "提案手法の数字を得て、ベースラインを上回るかを判断する。",
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
      title: "評価は正解率ではなくマクロ F1 にする（先生の指摘）",
      purpose: "不均衡データで手法の差を測れる指標に直すよう言われた。評価指標の検討に戻す。",
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
      "比べる手法が決まったので、比較実験の約束事を決めた",
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
      TASK.trainPy,
      "承認された spec にもとづいて、学習・評価スクリプトを実装する",
    ),
    flow(
      "demo-link-4",
      TASK.trainPy,
      TASK.cv,
      "スクリプトができたら、交差検証を実行する",
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
// デモの学習・評価スクリプトのコミットなら見せ場の変更を返し、それ以外は空の一覧を返す
export function demoMapUpdate(req: MapUpdateRequest): MapUpdateResponse {
  const { review } = req;
  if (review.commitSha !== MAIN_SHA) return { ops: [] };

  const shortSha = review.commitSha.slice(0, 7);
  const commit = demoCommits.find((c) => c.sha === review.commitSha);
  const commitSource: MapSource = {
    kind: "commit",
    path: review.commitSha,
    ...(commit ? { url: commit.url } : {}),
    label: `commit ${shortSha}`,
  };
  const dropna = review.findings.find((f) => f.summary === DROPNA_SUMMARY);
  const classWeight = review.findings.find((f) => f.summary === CLASS_WEIGHT_SUMMARY);

  const ops: MapOp[] = [
    {
      op: "update_task",
      taskId: TASK.trainPy,
      status: "done",
      statusSource: "record",
      result: `コミット ${shortSha} で実装済み`,
      reason: "学習・評価スクリプト train.py のコミットを取り込んだので、実装を完了にした",
    },
    {
      op: "add_task",
      tempId: "demo-temp-commit",
      phaseId: PHASE.implement,
      parentId: TASK.trainPy,
      milestoneId: MILESTONE.compare,
      title: `commit ${shortSha} 学習・評価スクリプトを追加`,
      purpose: "spec の比較実験を実行できるよう、2つの手法を5分割交差検証で評価するコードを入れた。",
      status: "done",
      statusSource: "record",
      sources: [commitSource],
      commitShas: [review.commitSha],
      reviewIds: [review.id],
      reason: "取り込んだコミットを、実装「train.py」のサブタスクとして記録した",
    },
    {
      op: "link_task",
      taskId: TASK.trainPy,
      commitShas: [review.commitSha],
      reviewIds: [review.id],
      reason: "このコミットと判定を、実装「train.py」に結び付けた",
    },
    {
      op: "update_task",
      taskId: TASK.missingDrop,
      status: "doing",
      statusSource: "ai",
      result: "AI が train.py で採用（比較の途中のまま）",
      reason:
        "AI が欠損のある行を除外して実装したため、比較中の「除外する」案が、検討を経ずに採用された状態になった",
    },
    ...(dropna
      ? [
          {
            op: "add_link",
            fromTaskId: TASK.trainPy,
            toTaskId: TASK.specCompareB1,
            kind: "impact",
            findingId: dropna.id,
            reason:
              "欠損行の除外でデータ件数が減り、B1「前処理と特徴量を両手法で揃える」の前提（同じデータで比べる）に影響する",
          } satisfies MapOp,
        ]
      : []),
    ...(classWeight
      ? [
          {
            op: "add_link",
            fromTaskId: TASK.trainPy,
            toTaskId: TASK.specCompareB3,
            kind: "impact",
            findingId: classWeight.id,
            reason:
              "class_weight をロジスティック回帰にだけ入れたので、B3「不均衡への対処を両手法で揃える」が満たされていない",
          } satisfies MapOp,
        ]
      : []),
    {
      op: "add_task",
      tempId: "demo-temp-optuna",
      phaseId: PHASE.implement,
      title: "記録のない実装：Optuna によるハイパーパラメータ探索",
      purpose: "どの spec にも無いのに、LightGBM にだけ50試行の探索が入った。比較の公平さを確かめる必要がある。",
      status: "done",
      statusSource: "record",
      statusRaw: "どの spec にも無い",
      sources: [commitSource],
      commitShas: [review.commitSha],
      reviewIds: [review.id],
      flag: "unrecorded",
      reason: "頼んでいない Optuna の探索がコミットに含まれていたが、記録のどこにも出てこないため",
    },
    {
      op: "update_task",
      taskId: TASK.cv,
      status: "todo",
      statusSource: "record",
      statusRaw: "実行できる",
      reason: "学習スクリプトができたので、「学習スクリプト待ち」が解けた",
    },
  ];

  return { ops, workspaceSha: WORKSPACE_SHA_AFTER };
}
