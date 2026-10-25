// 作業フローマップ（F-15）を画面上部の帯に小さく出すための計算。副作用のない関数だけを置く。
// 【担当：サブエージェント A。シグネチャは帯の担当（B）と親が使うので変えない】

import type { MapPhase, MapStatus, MapTask, WorkflowMap } from "@/lib/types";
import { effectiveStatus, sortedPhases, tasksInPhase } from "./view";

export type PhaseSummary = {
  phase: MapPhase;
  total: number; // レーンのタスク（親を持たないもの）の数
  counts: Record<MapStatus, number>; // effectiveStatus で数える。0 のものも入れる
  focus: MapTask[]; // そのレーンの「今ここ」（focusTasks のうち、このレーンのもの）
  // 進み具合の分母と分子。サブタスクを数え、サブタスクの無いタスクはそのタスクを1件として数える。不採用は数えない
  steps: { done: number; total: number };
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
    const steps = { done: 0, total: 0 };
    for (const task of tasks) {
      const status = effectiveStatus(map, task);
      counts[status] += 1;
      if (isFocusStatus(status)) focus.push(task);
      // 不採用のタスクは、そのサブタスクごと数えない
      if (status === "rejected") continue;
      const subtasks = map.tasks.filter((t) => t.parentId === task.id);
      const leaves = subtasks.length > 0 ? subtasks.map((s) => s.status) : [status];
      for (const leaf of leaves) {
        if (leaf === "rejected") continue;
        steps.total += 1;
        if (leaf === "done") steps.done += 1;
      }
    }
    return { phase, total: tasks.length, counts, focus, steps };
  });
}

// 画面に出す進み具合「済み/全体」（サブタスクの数）。数えるものが無ければ「—」
export function progressText(summary: PhaseSummary): string {
  const { done, total } = summary.steps;
  return total > 0 ? `${done}/${total}` : "—";
}

// 「今ここ」：親を持たないタスクのうち、effectiveStatus が doing か waiting のもの。
// レーンの order 順、同じレーンではタスクの order 順に並べる
export function focusTasks(map: WorkflowMap): MapTask[] {
  return sortedPhases(map).flatMap((phase) =>
    tasksInPhase(map, phase.id).filter((t) => isFocusStatus(effectiveStatus(map, t))),
  );
}

// 今ここをどう選んだか。update は直近の自動更新、record は出典の記録の日付、order はレーンの順
export type CurrentFocusReason = "update" | "record" | "order";

export type CurrentFocus = {
  current?: MapTask; // 今ここ（進行中・待ちのタスクが無ければ undefined）
  reason?: CurrentFocusReason;
  others: MapTask[]; // ほかに進行中・待ちのタスク（focusTasks の順）
};

// 出典のパスのファイル名の先頭の YYYY-MM-DD のうち、いちばん新しいもの
function latestSourceDate(task: MapTask): string | undefined {
  let latest: string | undefined;
  for (const source of task.sources) {
    const name = source.path.slice(source.path.lastIndexOf("/") + 1);
    const date = /^(\d{4}-\d{2}-\d{2})/.exec(name)?.[1];
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

// 「今ここ」を focusTasks から1件だけ選び、残りを others にする。
// ① 直近の自動更新で変わったタスク（changedParentIds の順で最初のもの）
// ② 出典の記録の日付がいちばん新しいもの（同じ日付ならレーンの順）
// ③ レーンの順で最初のもの
export function currentFocus(map: WorkflowMap): CurrentFocus {
  const focus = focusTasks(map);
  if (focus.length === 0) return { others: [] };

  const pick = (current: MapTask, reason: CurrentFocusReason): CurrentFocus => ({
    current,
    reason,
    others: focus.filter((t) => t.id !== current.id),
  });

  const focusIds = new Set(focus.map((t) => t.id));
  const changed = changedParentIds(map).find((id) => focusIds.has(id));
  if (changed) return pick(focus.find((t) => t.id === changed)!, "update");

  let newest: { task: MapTask; date: string } | undefined;
  for (const task of focus) {
    const date = latestSourceDate(task);
    if (date && (!newest || date > newest.date)) newest = { task, date };
  }
  if (newest) return pick(newest.task, "record");

  return pick(focus[0], "order");
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
