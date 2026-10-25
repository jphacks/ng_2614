// 作業フローマップ（F-15）を人が直す操作（場面2）。副作用のない関数だけを置く。
// どれも新しい WorkflowMap を返し、updatedAt を now にする。
// 【担当：サブエージェント A。シグネチャは画面側（C）が使うので変えない】
//
// この実装で決めたこと：
// - 対象（タスク・レーン・却下の index）が見つからないときや、何も変わらないときは、渡された map をそのまま返す
//   （新しいオブジェクトにも updatedAt の更新にもならない）。画面は古い id で呼んでも落ちない
// - 入力の文字列は前後の空白を除く。タイトル・レーン名が空になるときは、変えない（add 系は Error）

import type { MapPhase, MapStatus, MapTask, WorkflowMap } from "@/lib/types";

export type TaskTextPatch = { title?: string; purpose?: string };

function touch(map: WorkflowMap, now: string, patch: Partial<WorkflowMap>): WorkflowMap {
  return { ...map, ...patch, updatedAt: now };
}

function mapTask(
  map: WorkflowMap,
  taskId: string,
  update: (task: MapTask) => MapTask,
): MapTask[] {
  return map.tasks.map((t) => (t.id === taskId ? update(t) : t));
}

// 同じレーン・同じ親の中の末尾の order
function nextOrder(map: WorkflowMap, phaseId: string, parentId: string | undefined): number {
  return (
    map.tasks
      .filter((t) => t.phaseId === phaseId && t.parentId === parentId)
      .reduce((max, t) => Math.max(max, t.order), -1) + 1
  );
}

function byOrder(phases: MapPhase[]): MapPhase[] {
  return [...phases].sort((a, b) => a.order - b.order);
}

// タイトル・目的を直す。値が実際に変わったときだけ review を "edited" にする
export function editTaskText(
  map: WorkflowMap,
  taskId: string,
  patch: TaskTextPatch,
  now: string,
): WorkflowMap {
  const task = map.tasks.find((t) => t.id === taskId);
  if (!task) return map;
  const title = patch.title?.trim();
  const purpose = patch.purpose?.trim();
  const nextTitle = title ? title : task.title;
  const nextPurpose = purpose !== undefined ? purpose : task.purpose;
  if (nextTitle === task.title && nextPurpose === task.purpose) return map;
  return touch(map, now, {
    tasks: mapTask(map, taskId, (t) => ({
      ...t,
      title: nextTitle,
      purpose: nextPurpose,
      review: "edited",
    })),
  });
}

// 状態を手で変える。statusSource を "manual" にする。
// "rejected" にするときは rejectReason（空白だけは不可）が必須。無ければ Error を投げる。
// "rejected" 以外にするときは rejectReason を消す
export function setTaskStatus(
  map: WorkflowMap,
  taskId: string,
  status: MapStatus,
  rejectReason: string | undefined,
  now: string,
): WorkflowMap {
  const reason = rejectReason?.trim();
  if (status === "rejected" && !reason) {
    throw new Error("却下にするときは理由が必要です");
  }
  if (!map.tasks.some((t) => t.id === taskId)) return map;
  return touch(map, now, {
    tasks: mapTask(map, taskId, (t) => {
      const next: MapTask = { ...t, status, statusSource: "manual" };
      if (status === "rejected") next.rejectReason = reason;
      else delete next.rejectReason;
      return next;
    }),
  });
}

// 状態の手動の固定を外し、自動（record）に戻す
export function clearManualStatus(
  map: WorkflowMap,
  taskId: string,
  now: string,
): WorkflowMap {
  const task = map.tasks.find((t) => t.id === taskId);
  if (!task || task.statusSource !== "manual") return map;
  return touch(map, now, {
    tasks: mapTask(map, taskId, (t) => ({ ...t, statusSource: "record" })),
  });
}

// 確認済みにする（review が "unconfirmed" のときだけ "confirmed" にする。"edited" はそのまま）
export function confirmTask(
  map: WorkflowMap,
  taskId: string,
  now: string,
): WorkflowMap {
  const task = map.tasks.find((t) => t.id === taskId);
  if (!task || task.review !== "unconfirmed") return map;
  return touch(map, now, {
    tasks: mapTask(map, taskId, (t) => ({ ...t, review: "confirmed" })),
  });
}

// タスク（とそのサブタスク）を消し、却下の一覧に入れる。つながっていたリンクも消して、却下の記録に残す
export function deleteTask(
  map: WorkflowMap,
  taskId: string,
  reason: string | undefined,
  now: string,
): WorkflowMap {
  const task = map.tasks.find((t) => t.id === taskId);
  if (!task) return map;
  const removed = map.tasks.filter((t) => t.id === taskId || t.parentId === taskId);
  const removedIds = new Set(removed.map((t) => t.id));
  const removedLinks = map.links.filter(
    (l) => removedIds.has(l.fromTaskId) || removedIds.has(l.toTaskId),
  );
  const trimmed = reason?.trim();
  return touch(map, now, {
    tasks: map.tasks.filter((t) => !removedIds.has(t.id)),
    links: map.links.filter((l) => !removedLinks.includes(l)),
    rejected: [
      ...map.rejected,
      {
        title: task.title,
        reason: trimmed ? trimmed : undefined,
        at: now,
        tasks: removed,
        links: removedLinks,
      },
    ],
  });
}

// 却下の一覧の index 番目を戻す。タスクとリンクを元に戻し、一覧から外す。
// 戻すリンクのうち、相手のタスクがもう無いものは戻さない
// （戻すときに、元のレーンがもう無ければ先頭のレーンに入れる。元の親がもう無いサブタスクは、親を持たないタスクとして戻す。
//   レーンが1つも無いときは Error を投げる）
export function restoreRejected(
  map: WorkflowMap,
  index: number,
  now: string,
): WorkflowMap {
  const entry = map.rejected[index];
  if (!entry) return map;

  const phases = byOrder(map.phases);
  const phaseIds = new Set(phases.map((p) => p.id));
  const existingIds = new Set(map.tasks.map((t) => t.id));
  const incoming = entry.tasks.filter((t) => !existingIds.has(t.id));
  if (incoming.length > 0 && phases.length === 0) {
    throw new Error("戻すレーンがありません");
  }
  const availableIds = new Set([...existingIds, ...incoming.map((t) => t.id)]);

  // 親（先に戻すタスク）のレーンが決まってから、サブタスクのレーンを決める
  const phaseOf = new Map<string, string>();
  const restored: MapTask[] = [];
  const parents = incoming.filter((t) => !t.parentId || !availableIds.has(t.parentId));
  const children = incoming.filter((t) => t.parentId && availableIds.has(t.parentId));
  for (const t of parents) {
    const next: MapTask = { ...t };
    delete next.parentId;
    next.phaseId = phaseIds.has(t.phaseId) ? t.phaseId : phases[0].id;
    phaseOf.set(t.id, next.phaseId);
    restored.push(next);
  }
  for (const t of children) {
    const parentId = t.parentId as string;
    const parentPhase =
      phaseOf.get(parentId) ?? map.tasks.find((x) => x.id === parentId)?.phaseId;
    restored.push({ ...t, phaseId: parentPhase ?? t.phaseId });
  }

  // 元の並び（配列の順）で戻す
  const order = new Map(incoming.map((t, i) => [t.id, i]));
  restored.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const tasks = [...map.tasks, ...restored];
  const taskIds = new Set(tasks.map((t) => t.id));
  const linkIds = new Set(map.links.map((l) => l.id));
  const links = [
    ...map.links,
    ...entry.links.filter(
      (l) => !linkIds.has(l.id) && taskIds.has(l.fromTaskId) && taskIds.has(l.toTaskId),
    ),
  ];

  return touch(map, now, {
    tasks,
    links,
    rejected: map.rejected.filter((_, i) => i !== index),
  });
}

export type NewTaskInput = {
  phaseId: string;
  parentId?: string;
  milestoneId?: string;
  title: string;
  purpose: string;
};

// 人がタスク・サブタスクを足す。origin: "human"、review: "edited"、status: "todo"、statusSource: "manual"。
// parentId があるときは、phaseId を親と同じにする。order は末尾
// （タイトルが空、レーンや親が見つからない、親がサブタスクのときは Error を投げる）
export function addTask(
  map: WorkflowMap,
  input: NewTaskInput,
  now: string,
): { map: WorkflowMap; task: MapTask } {
  const title = input.title.trim();
  if (!title) throw new Error("タイトルが必要です");
  let phaseId = input.phaseId;
  if (input.parentId) {
    const parent = map.tasks.find((t) => t.id === input.parentId);
    if (!parent) throw new Error("親のタスクが見つかりません");
    if (parent.parentId) throw new Error("サブタスクの下にサブタスクは足せません");
    phaseId = parent.phaseId;
  }
  if (!map.phases.some((p) => p.id === phaseId)) {
    throw new Error("レーンが見つかりません");
  }
  const task: MapTask = {
    id: crypto.randomUUID(),
    phaseId,
    parentId: input.parentId,
    milestoneId: input.milestoneId,
    order: nextOrder(map, phaseId, input.parentId),
    title,
    purpose: input.purpose.trim(),
    status: "todo",
    statusSource: "manual",
    sources: [],
    commitShas: [],
    reviewIds: [],
    origin: "human",
    review: "edited",
  };
  return { map: touch(map, now, { tasks: [...map.tasks, task] }), task };
}

// レーンを末尾に足す（名前が空のときは Error を投げる）
export function addPhase(map: WorkflowMap, name: string, now: string): WorkflowMap {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("レーンの名前が必要です");
  const order = map.phases.reduce((max, p) => Math.max(max, p.order), -1) + 1;
  return touch(map, now, {
    phases: [...map.phases, { id: crypto.randomUUID(), name: trimmed, order, kinds: [] }],
  });
}

export function renamePhase(
  map: WorkflowMap,
  phaseId: string,
  name: string,
  now: string,
): WorkflowMap {
  const trimmed = name.trim();
  const phase = map.phases.find((p) => p.id === phaseId);
  if (!phase || !trimmed || phase.name === trimmed) return map;
  return touch(map, now, {
    phases: map.phases.map((p) => (p.id === phaseId ? { ...p, name: trimmed } : p)),
  });
}

// レーンを左（-1）か右（+1）に1つ動かす。端なら何もしない
export function movePhase(
  map: WorkflowMap,
  phaseId: string,
  delta: -1 | 1,
  now: string,
): WorkflowMap {
  const sorted = byOrder(map.phases);
  const from = sorted.findIndex((p) => p.id === phaseId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= sorted.length) return map;
  [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
  // order を 0 から振り直す（元の order が重なっていても、動かした結果が確かになる）
  return touch(map, now, { phases: sorted.map((p, i) => ({ ...p, order: i })) });
}

// レーンを消す。タスクが1つでも残っているレーンは消さずに Error を投げる
export function deletePhase(
  map: WorkflowMap,
  phaseId: string,
  now: string,
): WorkflowMap {
  if (!map.phases.some((p) => p.id === phaseId)) return map;
  if (map.tasks.some((t) => t.phaseId === phaseId)) {
    throw new Error("タスクが残っているレーンは消せません");
  }
  return touch(map, now, { phases: map.phases.filter((p) => p.id !== phaseId) });
}
