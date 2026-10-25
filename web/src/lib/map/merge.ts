// 作り直し（場面1）と取り込みごとの更新（場面3）で、新しく読んだマップと今のマップの差分を変更の一覧にする（F-15）。
// 当てはめは apply.ts の applyMapOps が行う（人の手直しの保護、却下したものの除外）。副作用のない関数だけを置く。
// サーバー（/api/map/update）と画面（作り直し）の両方から使う。
// 【担当：サブエージェント D1。シグネチャはルート（B）と画面（D2）が使うので変えない】

import { normalizeTitle } from "@/lib/map/apply";
import type { MapOp, MapSource, MapTask, Review, SourceKind, WorkflowMap } from "@/lib/types";

// add_task の op に key を付けて返す（types.ts の MapOp に key が無くても通る。apply.ts の applyMapOps が読む）
type AddTaskOp = Extract<MapOp, { op: "add_task" }> & { key?: string };

const KIND_LABEL: Record<SourceKind, string> = {
  brainstorm: "壁打ち",
  spec: "spec",
  experiment: "実験記録",
  meeting: "議事録",
  material: "資料",
  paper: "論文メモ",
  todo: "TODO",
  commit: "コミット",
};

function sameSource(a: MapSource, b: MapSource): boolean {
  return a.kind === b.kind && a.path === b.path;
}

// 追加の理由に出す、タスクの呼び方
function describeNew(task: MapTask): string {
  if (task.parentId) return "サブタスク";
  const kind = task.sources[0]?.kind;
  return kind ? KIND_LABEL[kind] : "タスク";
}

// fresh のタスク1つの add_task
function addOpFor(
  task: MapTask,
  parentId: string | undefined,
  phaseId: string,
): AddTaskOp {
  return {
    op: "add_task",
    key: task.key,
    tempId: task.id,
    phaseId,
    ...(parentId ? { parentId } : {}),
    ...(task.milestoneId ? { milestoneId: task.milestoneId } : {}),
    title: task.title,
    purpose: task.purpose,
    status: task.status,
    statusSource: task.statusSource === "ai" ? "ai" : "record",
    ...(task.statusRaw !== undefined ? { statusRaw: task.statusRaw } : {}),
    ...(task.result !== undefined ? { result: task.result } : {}),
    ...(task.rejectReason !== undefined ? { rejectReason: task.rejectReason } : {}),
    sources: task.sources,
    commitShas: task.commitShas,
    reviewIds: task.reviewIds,
    ...(task.flag ? { flag: task.flag } : {}),
    reason: `ワークスペースに新しい${describeNew(task)}「${task.title}」が増えた`,
  };
}

// fresh（ワークスペースから作り直したマップ、または変わったファイルだけから作った部分的なマップ）と current の差分。
// タスクは key で対応させる（key の無いタスクは対象外）：
// - current に同じ key が無い → add_task（tempId は fresh の id。parentId は、親の key が current にあればその id、
//   同じ一覧で足す親なら tempId）
// - ある → title・purpose・status（statusSource・statusRaw・result・rejectReason）が違えば update_task、
//   sources・commitShas が増えていれば link_task
// - fresh に無い current のタスクは、そのまま（消さない）
// - マイルストーンは id で対応させ、current に無いものを足す op は無いので、fresh の milestones は呼び出し側で合わせる
// - リンクは、両端の key が対応するもので current に無いものを add_link（kind・reason をそのまま）
// reason は op の種類ごとに短い日本語（例：「ワークスペースに新しい spec が増えた」）
export function diffToOps(current: WorkflowMap, fresh: WorkflowMap): MapOp[] {
  const currentByKey = new Map<string, MapTask>();
  for (const t of current.tasks) {
    if (t.key && !currentByKey.has(t.key)) currentByKey.set(t.key, t);
  }
  const freshById = new Map(fresh.tasks.map((t) => [t.id, t]));
  const keyed = fresh.tasks.filter((t) => t.key);
  const phaseIds = new Set(current.phases.map((p) => p.id));

  // fresh のタスクの id を、あとの op で使う id にする（current にあれば current の id、足すものなら tempId）
  const adding = new Set<string>();
  const toNew = keyed.filter((t) => !currentByKey.has(t.key!));
  for (const t of toNew) adding.add(t.id);
  const mapId = (freshId: string): string | undefined => {
    const t = freshById.get(freshId);
    if (!t?.key) return undefined;
    return currentByKey.get(t.key)?.id ?? (adding.has(t.id) ? t.id : undefined);
  };

  const ops: MapOp[] = [];

  // 足す：親を先に、サブタスクを後に（apply が tempId を後ろの op で使えるようにする）
  const addable = [...toNew.filter((t) => !t.parentId), ...toNew.filter((t) => t.parentId)];
  for (const t of addable) {
    let parentId: string | undefined;
    if (t.parentId) {
      parentId = mapId(t.parentId);
      // 親が対応しない（key が無い・current にも足す一覧にも無い）サブタスクは、親を決められないので足さない
      if (!parentId) {
        adding.delete(t.id);
        continue;
      }
    }
    // 人がレーンを消したり作り直したりして phaseId が合わないときは、同じ名前のレーンに入れる
    let phaseId = t.phaseId;
    if (!phaseIds.has(phaseId)) {
      const name = fresh.phases.find((p) => p.id === phaseId)?.name;
      const same = name ? current.phases.find((p) => p.name === name) : undefined;
      if (same) phaseId = same.id;
    }
    ops.push(addOpFor(t, parentId, phaseId));
  }

  // 変える：key が対応するタスク
  for (const t of keyed) {
    const c = currentByKey.get(t.key!);
    if (!c) continue;

    const changes: string[] = [];
    const update: Extract<MapOp, { op: "update_task" }> = {
      op: "update_task",
      taskId: c.id,
      reason: "",
    };
    if (t.title.trim() && normalizeTitle(t.title) !== normalizeTitle(c.title)) {
      update.title = t.title;
      changes.push("タイトル");
    }
    if (t.purpose.trim() && t.purpose !== c.purpose) {
      update.purpose = t.purpose;
      changes.push("目的");
    }
    // 状態：manual（人の決めたもの）は変えない。record のタスクを ai で変えるのも優先順位に反する。
    // どちらも apply.ts が当てはめないので、ここでも op にしない
    if (
      t.statusSource !== "manual" &&
      c.statusSource !== "manual" &&
      !(t.statusSource === "ai" && c.statusSource === "record")
    ) {
      const statusDiffers =
        t.status !== c.status ||
        (t.statusSource === "record" && c.statusSource === "ai") ||
        (t.statusRaw !== undefined && t.statusRaw !== c.statusRaw) ||
        (t.status === "rejected" && t.rejectReason !== c.rejectReason);
      if (statusDiffers) {
        update.status = t.status;
        update.statusSource = t.statusSource === "ai" ? "ai" : "record";
        if (t.statusRaw !== undefined) update.statusRaw = t.statusRaw;
        if (t.status === "rejected" && t.rejectReason !== undefined) {
          update.rejectReason = t.rejectReason;
        }
        changes.push("状態");
      }
    }
    if (t.result !== undefined && t.result !== c.result) {
      update.result = t.result;
      changes.push("結果");
    }
    if (changes.length > 0) {
      update.reason = `ワークスペースの内容に合わせて「${c.title}」の${changes.join("・")}を更新した`;
      ops.push(update);
    }

    const sources = t.sources.filter((s) => !c.sources.some((x) => sameSource(x, s)));
    const commitShas = t.commitShas.filter((sha) => !c.commitShas.includes(sha));
    if (sources.length > 0 || commitShas.length > 0) {
      ops.push({
        op: "link_task",
        taskId: c.id,
        ...(sources.length > 0 ? { sources } : {}),
        ...(commitShas.length > 0 ? { commitShas } : {}),
        reason: `ワークスペースの新しい出典を「${c.title}」に結び付けた`,
      });
    }
  }

  // つなぐ：両端が対応するリンクで、current に無いもの
  const seen = new Set<string>();
  for (const l of fresh.links) {
    const from = mapId(l.fromTaskId);
    const to = mapId(l.toTaskId);
    if (!from || !to || from === to) continue;
    const id = `${from}
${to}
${l.kind}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (current.links.some((x) => x.fromTaskId === from && x.toTaskId === to && x.kind === l.kind)) {
      continue;
    }
    ops.push({
      op: "add_link",
      fromTaskId: from,
      toTaskId: to,
      kind: l.kind,
      ...(l.findingId ? { findingId: l.findingId } : {}),
      reason: l.reason ?? "ワークスペースのつながりを反映した",
    });
  }

  return ops;
}

// fresh の milestones のうち current に無いものを足し、phases は current のまま（人の並べ替えを残す）にした
// マイルストーンの一覧を返す
export function mergeMilestones(current: WorkflowMap, fresh: WorkflowMap): WorkflowMap["milestones"] {
  const freshById = new Map(fresh.milestones.map((m) => [m.id, m]));
  const known = new Set(current.milestones.map((m) => m.id));
  // マイルストーンの済みは、ワークスペースの README だけが決めるので、fresh に合わせる
  const merged = current.milestones.map((m) => {
    const f = freshById.get(m.id);
    return f && f.done !== m.done ? { ...m, done: f.done } : m;
  });
  const titles = new Set(current.milestones.map((m) => normalizeTitle(m.title)));
  for (const m of fresh.milestones) {
    if (known.has(m.id) || titles.has(normalizeTitle(m.title))) continue;
    known.add(m.id);
    titles.add(normalizeTitle(m.title));
    merged.push(m);
  }
  return merged;
}

// 取り込んだ判定を、マップのタスクに結び付ける op（link_task で reviewIds と commitShas を足す）。
// review.commitSha のコミットのタスク（key "commit:<sha>"、または commitShas に含むタスク）があればそれに付ける。
// 無ければ空の一覧
export function reviewLinkOps(map: WorkflowMap, review: Review): MapOp[] {
  const sha = review.commitSha;
  if (!sha) return [];
  const ops: MapOp[] = [];
  for (const t of map.tasks) {
    const isCommitTask = t.key === `commit:${sha}` || t.commitShas.includes(sha);
    if (!isCommitTask) continue;
    const linked = t.reviewIds.includes(review.id) && t.commitShas.includes(sha);
    if (linked) continue;
    ops.push({
      op: "link_task",
      taskId: t.id,
      commitShas: [sha],
      reviewIds: [review.id],
      reason: `取り込んだ判定を「${t.title}」に結び付けた`,
    });
  }
  return ops;
}
