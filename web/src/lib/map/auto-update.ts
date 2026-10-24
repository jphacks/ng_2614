// 作業フローマップ（F-15）の更新を、画面から走らせる（クライアント側だけで使う）。
// - 判定を保存したとき（S-2 の取り込み、フックの受け取り箱）に startMapUpdate を呼ぶ。待たずに戻る
// - 判定結果の画面（S-3）は useMapUpdateStatus で、更新中・反映した内容・失敗を見せる
// - マップの画面（S-7）の「ワークスペースから更新」は refreshFromWorkspace、「マップを作る／作り直す」は generateOrRegenerate
// 【担当：サブエージェント D1。シグネチャは画面（D2）が使うので変えない】

import { useSyncExternalStore } from "react";
import { postMapGenerate, postMapUpdate } from "@/lib/api-client";
import { applyMapOps } from "@/lib/map/apply";
import { diffToOps, mergeMilestones } from "@/lib/map/merge";
import {
  MAPS_CHANGED_EVENT,
  getReview,
  getTheme,
  getWorkflowMap,
  nowIso,
  saveWorkflowMap,
} from "@/lib/storage";
import type { ResearchPurpose, ResearchTheme, Review, WorkflowMap } from "@/lib/types";

export type MapUpdateStatus =
  | { state: "none" } // その判定ではまだ何もしていない、またはマップが無い
  | { state: "running" }
  | { state: "done"; summaries: string[]; canUndo: boolean } // summaries が空なら「反映する変更なし」
  | { state: "error"; message: string };

const EVENT = "rc:map-update-status";
const NONE: MapUpdateStatus = { state: "none" };
const RUNNING: MapUpdateStatus = { state: "running" };

// 判定を使わない更新（「ワークスペースから更新」「作り直す」）で、applyMapOps に渡す reviewId の代わり。
// 当てはめたあと、appliedReviewIds からは外す（判定の id ではないので）。lastUpdate.reviewId にはこの値が残る
const REFRESH_ID = "workspace-refresh";
const REGENERATE_ID = "workspace-regenerate";

// ページを移っても（S-2 → S-3）状態が引き継がれるよう、モジュールの中に持つ。
// running と error だけ持ち、done は保存されたマップから決める（取り消しなどで保存が変わっても食い違わない）
const live = new Map<string, MapUpdateStatus>();
const themeOf = new Map<string, string>(); // reviewId → themeId
// 同じ判定で2回走らないようにする（React の開発モードで effect が2回走っても1回にする）
const inFlight = new Set<string>();
// 保存から決めた done を、内容が同じ間は同じ参照で返す（useSyncExternalStore が繰り返し呼ぶため）
const derived = new Map<string, { sig: string; status: MapUpdateStatus }>();

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function setLive(reviewId: string, status: MapUpdateStatus | undefined): void {
  if (status) live.set(reviewId, status);
  else live.delete(reviewId);
  emit();
}

function purposeOf(theme: ResearchPurpose): ResearchPurpose {
  return {
    name: theme.name,
    question: theme.question,
    method: theme.method,
    evaluation: theme.evaluation,
  };
}

// 代わりに使った reviewId を appliedReviewIds から外す（もともと入っていたときは外さない）
function withoutApplied(map: WorkflowMap, reviewId: string, before: WorkflowMap): WorkflowMap {
  if (before.appliedReviewIds.includes(reviewId)) return map;
  return { ...map, appliedReviewIds: map.appliedReviewIds.filter((id) => id !== reviewId) };
}

// 保存されたマップから、その判定の更新の状態を決める
function deriveStatus(reviewId: string): MapUpdateStatus {
  const themeId = themeOf.get(reviewId) ?? getReview(reviewId)?.themeId;
  const map = themeId ? getWorkflowMap(themeId) : undefined;
  if (!map || !map.appliedReviewIds.includes(reviewId)) return NONE;
  const last = map.lastUpdate?.reviewId === reviewId ? map.lastUpdate : undefined;
  const canUndo = !!last && !!map.previous;
  const sig = `${last?.at ?? ""}|${canUndo}`;
  const cached = derived.get(reviewId);
  if (cached && cached.sig === sig) return cached.status;
  const status: MapUpdateStatus = { state: "done", summaries: last?.summaries ?? [], canUndo };
  derived.set(reviewId, { sig, status });
  return status;
}

// その判定の更新の状態（useMapUpdateStatus の中身。フックを使えない場所やテストからも呼べる）
export function getMapUpdateStatus(reviewId: string): MapUpdateStatus {
  return live.get(reviewId) ?? deriveStatus(reviewId);
}

async function runUpdate(review: Review): Promise<void> {
  try {
    const map = getWorkflowMap(review.themeId);
    const theme = getTheme(review.themeId);
    if (!map || !theme) {
      setLive(review.id, undefined);
      return;
    }
    const { ops, workspaceSha } = await postMapUpdate({
      theme: purposeOf(theme),
      repo: theme.repo,
      map,
      review,
    });
    // 待っている間にマップの画面で直された分を消さないよう、読み直してから当てはめる
    const latest = getWorkflowMap(review.themeId);
    if (!latest || latest.appliedReviewIds.includes(review.id)) {
      setLive(review.id, undefined);
      return;
    }
    const result = applyMapOps(latest, ops, review.id, nowIso());
    saveWorkflowMap(workspaceSha ? { ...result.map, workspaceSha } : result.map);
    setLive(review.id, undefined);
  } catch (e) {
    setLive(review.id, {
      state: "error",
      message: e instanceof Error ? e.message : "マップを更新できませんでした。",
    });
  } finally {
    inFlight.delete(review.id);
  }
}

// 判定を保存した直後に呼ぶ。その研究テーマ（プロジェクト）のマップがあり、まだこの判定で更新していなければ、
// postMapUpdate → applyMapOps → saveWorkflowMap を行う（ops が空なら appliedReviewIds と workspaceSha だけ更新）。
// 同じ判定で2回走らないようにする。結果は useMapUpdateStatus と MAPS_CHANGED_EVENT で画面に伝える
export function startMapUpdate(review: Review): void {
  if (typeof window === "undefined") return;
  if (inFlight.has(review.id)) return;
  const map = getWorkflowMap(review.themeId);
  if (!map || !getTheme(review.themeId)) return;
  if (map.appliedReviewIds.includes(review.id)) return;
  inFlight.add(review.id);
  themeOf.set(review.id, review.themeId);
  setLive(review.id, RUNNING);
  void runUpdate(review);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener(MAPS_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange); // 別のタブで更新したとき
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener(MAPS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// その判定の更新の状態。ページを移っても（S-2 → S-3）状態が引き継がれるよう、モジュールの中に持ち、
// 無ければ保存されたマップ（appliedReviewIds・lastUpdate）から決める。サーバー側では "none"
export function useMapUpdateStatus(reviewId: string): MapUpdateStatus {
  return useSyncExternalStore(
    subscribe,
    () => getMapUpdateStatus(reviewId),
    () => NONE,
  );
}

// 「ワークスペースから更新」：review なしで postMapUpdate を呼び、当てはめて保存する。反映した件数を返す
export async function refreshFromWorkspace(theme: ResearchTheme): Promise<number> {
  const map = getWorkflowMap(theme.id);
  if (!map) throw new Error("作業フローマップがまだありません。先にマップを作ってください。");
  const { ops, workspaceSha } = await postMapUpdate({
    theme: purposeOf(theme),
    repo: theme.repo,
    map,
  });
  // 待っている間に直された分を消さないよう、読み直してから当てはめる
  const latest = getWorkflowMap(theme.id);
  if (!latest) throw new Error("作業フローマップが見つかりません。");
  const result = applyMapOps(latest, ops, REFRESH_ID, nowIso());
  saveWorkflowMap({
    ...withoutApplied(result.map, REFRESH_ID, latest),
    ...(workspaceSha ? { workspaceSha } : {}),
  });
  return result.applied.length;
}

// 「マップを作る」「作り直す」：postMapGenerate を呼ぶ。マップが無ければそのまま保存し、
// あれば diffToOps と applyMapOps で当てはめ（人の手直しと却下したものを守る）、mergeMilestones も反映して保存する。
// workspaceRepo・workspaceProject は、引数で渡されたもの、無ければ保存されたマップのものを使う
export async function generateOrRegenerate(
  theme: ResearchTheme,
  workspace: { workspaceRepo?: string; workspaceProject?: string },
): Promise<WorkflowMap> {
  const existing = getWorkflowMap(theme.id);
  const workspaceRepo = workspace.workspaceRepo ?? existing?.workspaceRepo;
  const workspaceProject = workspace.workspaceProject ?? existing?.workspaceProject;
  const { map: fresh } = await postMapGenerate({
    themeId: theme.id,
    theme: purposeOf(theme),
    repo: theme.repo,
    ...(workspaceRepo ? { workspaceRepo } : {}),
    ...(workspaceProject ? { workspaceProject } : {}),
  });
  // 引数と保存されたマップに無ければ、返ってきたマップのものを使う
  const repoField = workspaceRepo ?? fresh.workspaceRepo;
  const projectField = workspaceProject ?? fresh.workspaceProject;
  const workspaceFields = {
    ...(repoField ? { workspaceRepo: repoField } : {}),
    ...(projectField ? { workspaceProject: projectField } : {}),
  };

  // 待っている間に直された分を消さないよう、読み直してから当てはめる
  const latest = getWorkflowMap(theme.id);
  if (!latest) return saveWorkflowMap({ ...fresh, themeId: theme.id, ...workspaceFields });

  const now = nowIso();
  const base: WorkflowMap = {
    ...latest,
    ...workspaceFields,
    milestones: mergeMilestones(latest, fresh),
    ...(fresh.workspaceSha ? { workspaceSha: fresh.workspaceSha } : {}),
  };
  const result = applyMapOps(base, diffToOps(latest, fresh), REGENERATE_ID, now);
  return saveWorkflowMap({
    ...withoutApplied(result.map, REGENERATE_ID, latest),
    updatedAt: now,
  });
}
