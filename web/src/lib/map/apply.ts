// 作業フローマップ（F-15）の自動更新：AI（デモではデモデータ）が返した変更の一覧を、マップに当てはめる。
// 副作用のない関数だけを置く（保存は storage.ts、呼び出しは画面）。
// 【担当：サブエージェント A。シグネチャは画面側（C）と親が使うので変えない】

import type {
  MapLink,
  MapOp,
  MapSource,
  MapTask,
  WorkflowMap,
  WorkflowMapSnapshot,
} from "@/lib/types";

// 当てはめなかった変更と、その理由（画面には出さないが、テストとログで使う）
export type SkippedOp = { op: MapOp; why: string };

export type ApplyResult = {
  map: WorkflowMap;
  applied: MapOp[];
  skipped: SkippedOp[];
};

// タイトルの比べ方：前後の空白を除き、全角・半角の英数字と空白の違い、大文字小文字の違いを無視する
export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

// 前後の空白を除いて、空なら undefined
function trimmedOrUndefined(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

function sameSource(a: MapSource, b: MapSource): boolean {
  return a.kind === b.kind && a.path === b.path;
}

// update_task で値が実際に変わったか（配列は触らないので、参照で比べてよい）
function taskChanged(before: MapTask, after: MapTask): boolean {
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ] as (keyof MapTask)[]);
  for (const key of keys) {
    if (before[key] !== after[key]) return true;
  }
  return false;
}

// 変更の一覧をマップに当てはめる。
// - 当てはめる前のマップを map.previous に入れる（取り消し用。previous の中の previous は持たない）
// - map.lastUpdate に reviewId・時刻・反映した変更の reason・変わったタスクの id を入れる
// - map.appliedReviewIds に reviewId を足す
// - 保護の規則：
//   - review が "edited" のタスク：title・purpose・status は変えない（link_task は許す）
//   - review が "confirmed" のタスク：title・purpose は変えない。status は変えてよい
//   - statusSource が "manual" のタスク：status を変えない
//   - add_task：却下の一覧（map.rejected）とタイトルが同じもの、同じレーン・同じ親に同じタイトルがあるものは足さない
//     （タイトルは前後の空白を除き、全角・半角の英数字と空白の違いを無視して比べる）
//   - add_link：両端のタスクが無いもの、同じ from・to・kind がすでにあるものは足さない
// - add_task の tempId は、新しい id に置き換える。同じ一覧の後ろの op は parentId・fromTaskId・toTaskId に tempId を使える
// - 足したタスクは origin: "ai"、review: "unconfirmed"。order は同じレーン・同じ親の末尾
// - status が "rejected" で rejectReason が無い add_task / update_task は当てはめない
//
// この実装で決めたこと：
// - 1つも当てはめられなかったときは、appliedReviewIds に reviewId を足すだけで、previous と lastUpdate は変えない
//   （直前の自動更新の取り消しが、別の判定の取り消しになってしまわないようにする）
// - update_task で一部のフィールドだけ保護に当たったときは、通るものだけ当てはめて applied に入れる（skipped には入れない）
// - statusRaw・rejectReason は status と一緒に動く（status を変えないときは変えない）。result は保護の対象にしない
// - add_task の parentId があるときは、レーンは親と同じにする。親が見つからない・親がサブタスクのときは足さない
export function applyMapOps(
  map: WorkflowMap,
  ops: MapOp[],
  reviewId: string,
  now: string,
): ApplyResult {
  let tasks: MapTask[] = map.tasks;
  let links: MapLink[] = map.links;
  const tempIds = new Map<string, string>();
  const applied: MapOp[] = [];
  const skipped: SkippedOp[] = [];
  const changedTaskIds: string[] = [];

  const resolve = (id: string) => tempIds.get(id) ?? id;
  const findTask = (id: string) => tasks.find((t) => t.id === id);
  const markChanged = (id: string) => {
    if (!changedTaskIds.includes(id)) changedTaskIds.push(id);
  };
  const replaceTask = (next: MapTask) => {
    tasks = tasks.map((t) => (t.id === next.id ? next : t));
    markChanged(next.id);
  };
  const skip = (op: MapOp, why: string) => skipped.push({ op, why });

  const rejectedTitles = new Set(map.rejected.map((r) => normalizeTitle(r.title)));

  for (const op of ops) {
    if (op.op === "add_task") {
      const title = op.title.trim();
      if (!title) {
        skip(op, "タイトルが空");
        continue;
      }
      if (op.status === "rejected" && !trimmedOrUndefined(op.rejectReason)) {
        skip(op, "却下の状態だが、理由が無い");
        continue;
      }
      let phaseId = op.phaseId;
      let parentId: string | undefined;
      if (op.parentId) {
        const parent = findTask(resolve(op.parentId));
        if (!parent) {
          skip(op, "親のタスクが見つからない");
          continue;
        }
        if (parent.parentId) {
          skip(op, "サブタスクの下にはサブタスクを足せない");
          continue;
        }
        parentId = parent.id;
        phaseId = parent.phaseId;
      }
      if (!map.phases.some((p) => p.id === phaseId)) {
        skip(op, "レーンが見つからない");
        continue;
      }
      const key = normalizeTitle(title);
      if (rejectedTitles.has(key)) {
        skip(op, "却下の一覧に同じタイトルがある");
        continue;
      }
      const siblings = tasks.filter((t) => t.phaseId === phaseId && t.parentId === parentId);
      if (siblings.some((t) => normalizeTitle(t.title) === key)) {
        skip(op, "同じレーン・同じ親に同じタイトルがある");
        continue;
      }
      const task: MapTask = {
        id: crypto.randomUUID(),
        phaseId,
        parentId,
        milestoneId: map.milestones.some((m) => m.id === op.milestoneId)
          ? op.milestoneId
          : undefined,
        order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
        title,
        purpose: op.purpose,
        status: op.status,
        statusSource: op.statusSource,
        statusRaw: op.statusRaw,
        result: op.result,
        rejectReason:
          op.status === "rejected" ? trimmedOrUndefined(op.rejectReason) : undefined,
        sources: op.sources,
        commitShas: op.commitShas,
        reviewIds: op.reviewIds,
        flag: op.flag,
        origin: "ai",
        review: "unconfirmed",
      };
      tempIds.set(op.tempId, task.id);
      tasks = [...tasks, task];
      markChanged(task.id);
      applied.push(op);
      continue;
    }

    if (op.op === "update_task") {
      const task = findTask(resolve(op.taskId));
      if (!task) {
        skip(op, "タスクが見つからない");
        continue;
      }
      // 却下にするのに理由が無いものは、ほかのフィールドも含めて当てはめない
      let rejectReason: string | undefined;
      if (op.status === "rejected") {
        rejectReason =
          trimmedOrUndefined(op.rejectReason) ??
          (task.status === "rejected" ? trimmedOrUndefined(task.rejectReason) : undefined);
        if (!rejectReason) {
          skip(op, "却下の状態だが、理由が無い");
          continue;
        }
      }
      const textLocked = task.review !== "unconfirmed";
      const statusLocked = task.review === "edited" || task.statusSource === "manual";
      const next: MapTask = { ...task };
      const locked: string[] = [];

      const title = op.title?.trim();
      if (title) {
        if (textLocked) locked.push("title");
        else next.title = title;
      }
      if (op.purpose !== undefined) {
        if (textLocked) locked.push("purpose");
        else next.purpose = op.purpose;
      }
      if (op.status !== undefined) {
        if (statusLocked) {
          locked.push("status");
        } else {
          next.status = op.status;
          next.statusSource = op.statusSource ?? task.statusSource;
          if (op.statusRaw !== undefined) next.statusRaw = op.statusRaw;
          if (op.status === "rejected") next.rejectReason = rejectReason;
          else delete next.rejectReason;
        }
      } else if (
        !statusLocked &&
        task.status === "rejected" &&
        trimmedOrUndefined(op.rejectReason)
      ) {
        // 状態は変えず、却下の理由だけ直す
        next.rejectReason = trimmedOrUndefined(op.rejectReason);
      }
      if (op.result !== undefined) next.result = op.result;

      if (!taskChanged(task, next)) {
        skip(
          op,
          locked.length > 0 ? `保護のため変えない（${locked.join("・")}）` : "すでに同じ内容",
        );
        continue;
      }
      replaceTask(next);
      applied.push(op);
      continue;
    }

    if (op.op === "link_task") {
      const task = findTask(resolve(op.taskId));
      if (!task) {
        skip(op, "タスクが見つからない");
        continue;
      }
      const sources = [...task.sources];
      for (const s of op.sources ?? []) {
        if (!sources.some((x) => sameSource(x, s))) sources.push(s);
      }
      const commitShas = [...task.commitShas];
      for (const sha of op.commitShas ?? []) {
        if (!commitShas.includes(sha)) commitShas.push(sha);
      }
      const reviewIds = [...task.reviewIds];
      for (const id of op.reviewIds ?? []) {
        if (!reviewIds.includes(id)) reviewIds.push(id);
      }
      if (
        sources.length === task.sources.length &&
        commitShas.length === task.commitShas.length &&
        reviewIds.length === task.reviewIds.length
      ) {
        skip(op, "すでに記録済み");
        continue;
      }
      replaceTask({ ...task, sources, commitShas, reviewIds });
      applied.push(op);
      continue;
    }

    // add_link
    const from = findTask(resolve(op.fromTaskId));
    const to = findTask(resolve(op.toTaskId));
    if (!from || !to) {
      skip(op, "つなぐ先のタスクが見つからない");
      continue;
    }
    if (from.id === to.id) {
      skip(op, "同じタスクどうしはつなげない");
      continue;
    }
    if (
      links.some((l) => l.fromTaskId === from.id && l.toTaskId === to.id && l.kind === op.kind)
    ) {
      skip(op, "同じリンクがすでにある");
      continue;
    }
    links = [
      ...links,
      {
        id: crypto.randomUUID(),
        fromTaskId: from.id,
        toTaskId: to.id,
        kind: op.kind,
        reason: op.reason,
        findingId: op.findingId,
      },
    ];
    applied.push(op);
  }

  const appliedReviewIds = map.appliedReviewIds.includes(reviewId)
    ? map.appliedReviewIds
    : [...map.appliedReviewIds, reviewId];

  if (applied.length === 0) {
    return { map: { ...map, appliedReviewIds }, applied, skipped };
  }

  // previous の中の previous は持たない
  const { previous: _older, ...snapshot } = map;
  void _older;
  const previous: WorkflowMapSnapshot = snapshot;

  return {
    map: {
      ...map,
      tasks,
      links,
      appliedReviewIds,
      lastUpdate: {
        reviewId,
        at: now,
        summaries: applied.map((o) => o.reason),
        changedTaskIds,
      },
      previous,
      updatedAt: now,
    },
    applied,
    skipped,
  };
}

// 直近の自動更新を取り消す。previous が無ければ undefined。
// 取り消した後も appliedReviewIds にはその reviewId を残す（同じ判定で再び自動更新しないため）
// （lastUpdate は消す。updatedAt は取り消す前のスナップショットのまま）
export function undoLastUpdate(map: WorkflowMap): WorkflowMap | undefined {
  const previous = map.previous;
  if (!previous) return undefined;
  const appliedReviewIds = [...previous.appliedReviewIds];
  for (const id of map.appliedReviewIds) {
    if (!appliedReviewIds.includes(id)) appliedReviewIds.push(id);
  }
  return { ...previous, appliedReviewIds, lastUpdate: undefined };
}
