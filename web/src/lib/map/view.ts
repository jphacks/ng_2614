// 作業フローマップ（F-15）を画面に出すための計算。副作用のない関数だけを置く。
// 【担当：サブエージェント A。シグネチャは画面側（C）が使うので変えない】

import type {
  MapLink,
  MapPhase,
  MapStatus,
  MapTask,
  WorkflowMap,
} from "@/lib/types";

// 状態の言葉。順に todo / doing / waiting / done / rejected
type Labels = [string, string, string, string, string];

const DEFAULT_LABELS: Labels = ["未着手", "進行中", "待ち", "完了", "不採用"];

const LABELS_BY_KIND: Record<string, Labels> = {
  brainstorm: ["未着手", "比較中", "保留", "結論あり", "不採用"],
  paper: ["未着手", "読んでいる", "保留", "読んだ", "不採用"],
  spec: ["未着手", "draft", "承認待ち", "承認済み", "不採用"],
  commit: ["未着手", "未commitあり", "待ち", "commit済み", "取りやめ"],
  experiment: ["未実施", "一部実施", "実行の許可待ち", "実施済み", "取りやめ"],
  meeting: ["未着手", "資料作成中", "MTG待ち", "MTG済み", "取りやめ"],
  material: ["未着手", "資料作成中", "MTG待ち", "MTG済み", "取りやめ"],
};

const STATUS_INDEX: Record<MapStatus, number> = {
  todo: 0,
  doing: 1,
  waiting: 2,
  done: 3,
  rejected: 4,
};

// 画面に出す状態の名前。レーンの kinds の先頭で言葉を変える（docs/design.md の「作業フローマップの状態」）
//            todo    doing          waiting       done         rejected
// brainstorm 未着手  比較中         保留          結論あり     不採用
// paper      未着手  読んでいる     保留          読んだ       不採用
// spec       未着手  draft          承認待ち      承認済み     不採用
// commit     未着手  未commitあり   待ち          commit済み   取りやめ
// experiment 未実施  一部実施       実行の許可待ち 実施済み    取りやめ
// meeting / material 未着手 資料作成中 MTG待ち    MTG済み      取りやめ
// それ以外（kinds が空など） 未着手 進行中 待ち 完了 不採用
export function statusLabel(phase: MapPhase | undefined, status: MapStatus): string {
  const kind = phase?.kinds[0];
  const labels = (kind && LABELS_BY_KIND[kind]) || DEFAULT_LABELS;
  return labels[STATUS_INDEX[status]];
}

// 画面に出す状態。サブタスクを持つタスクで、statusSource が "manual" でないときはサブタスクから決める：
// - サブタスクがすべて done か rejected（rejected だけの場合は rejected）→ done
// - 1つでも doing → doing
// - waiting があり、残りが done / rejected → waiting
// - すべて todo → task.status（比較中・待ちなど、サブタスクに手を付ける前の親の状態を残す）
// - それ以外（todo と done が混ざるなど）→ doing
// サブタスクを持たないタスクは task.status のまま
//
// この実装で決めたこと：rejected のサブタスクは、done と同じく「無いもの」として数える
// （todo と rejected だけなら task.status）。サブタスクが rejected だけのときだけ rejected
export function effectiveStatus(map: WorkflowMap, task: MapTask): MapStatus {
  if (task.statusSource === "manual") return task.status;
  const subtasks = subtasksOf(map, task.id);
  if (subtasks.length === 0) return task.status;
  const active = subtasks.filter((t) => t.status !== "rejected");
  if (active.length === 0) return "rejected";
  const statuses = active.map((t) => t.status);
  if (statuses.every((s) => s === "done")) return "done";
  if (statuses.includes("doing")) return "doing";
  if (statuses.includes("waiting") && statuses.every((s) => s === "waiting" || s === "done")) {
    return "waiting";
  }
  if (statuses.every((s) => s === "todo")) return task.status;
  return "doing";
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  // 配列の順を保ったまま order で並べる（同じ order のときは元の順）
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.order - b.item.order || a.index - b.index)
    .map((x) => x.item);
}

// レーンの中に並べるタスク（親を持たないもの）を order 順に返す
export function tasksInPhase(map: WorkflowMap, phaseId: string): MapTask[] {
  return sortByOrder(map.tasks.filter((t) => t.phaseId === phaseId && !t.parentId));
}

// サブタスクを order 順に返す
export function subtasksOf(map: WorkflowMap, taskId: string): MapTask[] {
  return sortByOrder(map.tasks.filter((t) => t.parentId === taskId));
}

// レーンを order 順に返す
export function sortedPhases(map: WorkflowMap): MapPhase[] {
  return sortByOrder(map.phases);
}

// 目的のつながり：選んだタスクから、研究の問いに向かってさかのぼった順（問いに近い側が先頭、選んだタスクが末尾）。
// たどり方：サブタスクなら親へ。親（またはサブタスクを持たないタスク）からは、
// そのタスクかその親に向かう flow リンクの fromTaskId へ（複数あれば最初のもの）。
// 同じタスクを2回通ったら止める（循環の対策）
//
// この実装で決めたこと：リンクはそのタスク自身に向かうものだけを見る（サブタスクは先に親へ上がるので、
// 「その親に向かう」リンクは親の番で見つかる）。選んだタスクが無ければ空の配列
export function purposeChain(map: WorkflowMap, taskId: string): MapTask[] {
  const byId = new Map(map.tasks.map((t) => [t.id, t]));
  const chain: MapTask[] = [];
  const visited = new Set<string>();
  let current = byId.get(taskId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    if (current.parentId) {
      current = byId.get(current.parentId);
      continue;
    }
    const target: string = current.id;
    const link = map.links.find(
      (l) => l.kind === "flow" && l.toTaskId === target && byId.has(l.fromTaskId),
    );
    current = link ? byId.get(link.fromTaskId) : undefined;
  }
  return chain.reverse();
}

// そのタスク（サブタスクを含む）から出ているリンクと、入ってくるリンク
export function linksOf(
  map: WorkflowMap,
  taskId: string,
): { incoming: MapLink[]; outgoing: MapLink[] } {
  const ids = new Set([taskId]);
  for (const t of map.tasks) {
    if (t.parentId === taskId) ids.add(t.id);
  }
  return {
    incoming: map.links.filter((l) => ids.has(l.toTaskId)),
    outgoing: map.links.filter((l) => ids.has(l.fromTaskId)),
  };
}

// review が "unconfirmed" のタスクの数（サブタスクを含む）
export function unconfirmedCount(map: WorkflowMap): number {
  return map.tasks.filter((t) => t.review === "unconfirmed").length;
}
