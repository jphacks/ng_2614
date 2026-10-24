// 作業フローマップ（F-15）の表示用の定数と小さな関数

import type { CurrentFocusReason } from "@/lib/map/summary";
import type {
  MapStatus,
  MapStatusSource,
  SourceKind,
  WorkflowMap,
} from "@/lib/types";

export const STATUS_ORDER: MapStatus[] = [
  "todo",
  "doing",
  "waiting",
  "done",
  "rejected",
];

// 状態の色。色だけに頼らないよう、バッジには必ず文字（statusLabel）も出す
export const STATUS_BADGE: Record<MapStatus, string> = {
  todo: "bg-gray-100 text-gray-700",
  doing: "bg-blue-100 text-blue-800",
  waiting: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  rejected: "bg-red-50 text-red-700",
};

export const STATUS_ICON: Record<MapStatus, { mark: string; className: string }> =
  {
    todo: { mark: "○", className: "text-gray-400" },
    doing: { mark: "◐", className: "text-blue-600" },
    waiting: { mark: "⏸", className: "text-amber-600" },
    done: { mark: "✓", className: "text-green-600" },
    rejected: { mark: "✕", className: "text-red-500" },
  };

// 今ここをどう選んだか（lib/map/summary.ts の currentFocus）
export const FOCUS_REASON_TEXT: Record<CurrentFocusReason, string> = {
  update: "直近の更新で変わったタスク",
  record: "いちばん新しい記録のタスク",
  order: "進行中・待ちのうち、工程の順で最初のタスク",
};

export const STATUS_SOURCE_LABEL: Record<MapStatusSource, string> = {
  manual: "手動",
  record: "記録",
  ai: "AI推測",
};

export const STATUS_SOURCE_HINT: Record<MapStatusSource, string> = {
  manual: "人が手で決めた状態（自動では上書きしません）",
  record: "ワークスペースの記録から決めた状態",
  ai: "記録が無く、AI が本文から推測した状態",
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  brainstorm: "壁打ち",
  spec: "設計",
  experiment: "実験",
  meeting: "打ち合わせ",
  material: "資料",
  paper: "論文",
  todo: "TODO",
  commit: "コミット",
};

// マイルストーンの色。マイルストーンの並び順ごとに固定で割り当てる
const MILESTONE_STYLES = [
  "bg-violet-100 text-violet-800",
  "bg-sky-100 text-sky-800",
  "bg-teal-100 text-teal-800",
  "bg-pink-100 text-pink-800",
  "bg-orange-100 text-orange-800",
  "bg-lime-100 text-lime-800",
];

export function milestoneStyle(map: WorkflowMap, milestoneId: string): string {
  const index = map.milestones.findIndex((m) => m.id === milestoneId);
  return MILESTONE_STYLES[(index < 0 ? 0 : index) % MILESTONE_STYLES.length];
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "不明なエラーが起きました";
}

// マイルストーンの絞り込み。"all" は全部、"none" はマイルストーンなし、それ以外はマイルストーンの id
export type MilestoneFilter = "all" | "none" | string;

export function matchesFilter(
  filter: MilestoneFilter,
  milestoneId: string | undefined,
): boolean {
  if (filter === "all") return true;
  if (filter === "none") return milestoneId === undefined;
  return milestoneId === filter;
}
