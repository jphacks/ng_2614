// 作業フローマップ（F-15）の表示用の定数と小さな関数

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

// 状態の見た目（globals.css の tag と組み合わせる）。進行中は藍、待ちは空、済みは若葉で分け、
// 色だけに頼らないよう、枠の線を変え、必ず文字（statusLabel）も出す
export const STATUS_BADGE: Record<MapStatus, string> = {
  todo: "text-ink-3",
  doing: "border-accent bg-accent text-paper",
  waiting: "border-dashed text-sky-ink",
  done: "text-mint-ink",
  rejected: "text-ink-3 line-through",
};

export const STATUS_ICON: Record<MapStatus, { mark: string; className: string }> =
  {
    todo: { mark: "○", className: "text-ink-3" },
    doing: { mark: "◐", className: "text-accent" },
    waiting: { mark: "⏸", className: "text-sky-ink" },
    done: { mark: "✓", className: "text-mint-ink" },
    rejected: { mark: "✕", className: "text-ink-3" },
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

// マイルストーンの見た目（tag と組み合わせる）。藍・空・若葉と枠の線で分ける。
// マイルストーンの並び順ごとに固定で割り当てる
const MILESTONE_STYLES = [
  "text-accent-deep",
  "text-sky-ink",
  "text-mint-ink",
  "border-dashed text-accent-deep",
  "border-dashed text-sky-ink",
  "border-dashed text-mint-ink",
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
