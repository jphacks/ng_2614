// 作業フローマップ（F-15）を画面上部の帯に小さく出すための計算。副作用のない関数だけを置く。
// 【担当：サブエージェント A。シグネチャは帯の担当（B）と親が使うので変えない】

import type { MapPhase, MapStatus, MapTask, WorkflowMap } from "@/lib/types";
import { effectiveStatus, sortedPhases, tasksInPhase } from "./view";

export type PhaseSummary = {
  phase: MapPhase;
  total: number; // レーンのタスク（親を持たないもの）の数
  counts: Record<MapStatus, number>; // effectiveStatus で数える。0 のものも入れる
  focus: MapTask[]; // そのレーンの「今ここ」（focusTasks のうち、このレーンのもの）
};

// 今ここ（進行中か待ち）にあたる状態
function isFocusStatus(status: MapStatus): boolean {
  return status === "doing" || status === "waiting";
}

// レーンごとのまとめを、レーンの order 順に返す
export function phaseSummaries(map: WorkflowMap): PhaseSummary[] {
  return sortedPhases(map).map((phase) => {
    const tasks = tasksInPhase(map, phase.id);
    const counts: Record<MapStatus, number> = {
      todo: 0,
      doing: 0,
      waiting: 0,
      done: 0,
      rejected: 0,
    };
    const focus: MapTask[] = [];
    for (const task of tasks) {
      const status = effectiveStatus(map, task);
      counts[status] += 1;
      if (isFocusStatus(status)) focus.push(task);
    }
    return { phase, total: tasks.length, counts, focus };
  });
}

// 「今ここ」：親を持たないタスクのうち、effectiveStatus が doing か waiting のもの。
// レーンの order 順、同じレーンではタスクの order 順に並べる
export function focusTasks(map: WorkflowMap): MapTask[] {
  return sortedPhases(map).flatMap((phase) =>
    tasksInPhase(map, phase.id).filter((t) => isFocusStatus(effectiveStatus(map, t))),
  );
}

// 直近の自動更新で変わったタスクを、親を持たないタスクの id にそろえて返す
// （サブタスクが変わったときは、その親の id にする。重複は除き、無くなったタスクは除く）
//
// この実装で決めたこと：並びは changedTaskIds に最初に出てきた順。親が無くなっているサブタスクも除く
export function changedParentIds(map: WorkflowMap): string[] {
  const ids = map.lastUpdate?.changedTaskIds ?? [];
  const byId = new Map(map.tasks.map((t) => [t.id, t]));
  const result = new Set<string>();
  for (const id of ids) {
    const task = byId.get(id);
    if (!task) continue;
    const top = task.parentId ? byId.get(task.parentId) : task;
    if (top) result.add(top.id);
  }
  return [...result];
}

function segmentsOf(pathname: string): string[] {
  // クエリとハッシュは URL の一部としては付いてこない想定だが、付いていても無視する
  const path = pathname.split(/[?#]/, 1)[0];
  return path.split("/").filter((s) => s !== "");
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // 壊れたエンコードはそのまま使う
  }
}

// URL から研究テーマの id を決める。
// /themes/[themeId] とその下（/themes/[themeId]/reviews/new など）→ themeId
// /reviews/[reviewId] → reviewThemeId(reviewId) の結果
// それ以外（/ など）→ undefined。id は decodeURIComponent する
export function themeIdFromPath(
  pathname: string,
  reviewThemeId: (reviewId: string) => string | undefined,
): string | undefined {
  const [first, second] = segmentsOf(pathname);
  if (second === undefined) return undefined;
  if (first === "themes") return decodeSegment(second);
  if (first === "reviews") return reviewThemeId(decodeSegment(second));
  return undefined;
}

// 作業フローマップの画面（/themes/[themeId]/map）なら true。帯はここでは出さない
export function isMapPage(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  return segments.length >= 3 && segments[0] === "themes" && segments[2] === "map";
}
