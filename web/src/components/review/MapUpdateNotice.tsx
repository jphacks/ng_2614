"use client";

// 判定結果の画面（S-3）で、作業フローマップ（F-15）を自動で更新し、その結果を知らせる（場面3）。
// その研究テーマのマップがあり、まだこの判定で更新していなければ、開いたときに1回だけ更新する。

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { postMapUpdate } from "@/lib/api-client";
import { applyMapOps, undoLastUpdate } from "@/lib/map/apply";
import {
  getTheme,
  getWorkflowMap,
  nowIso,
  saveWorkflowMap,
} from "@/lib/storage";
import type { Review } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "noMap" }
  | { status: "updating" }
  | { status: "updated"; summaries: string[]; canUndo: boolean }
  | { status: "nothing" } // 反映する変更が無かった
  | { status: "already" } // 前に開いたときに更新済み
  | { status: "undone" }
  | { status: "error"; message: string };

// React の開発モードで effect が2回走っても、同じ判定で2回更新しないようにする
const inFlight = new Set<string>();

export function MapUpdateNotice({ review }: { review: Review }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const mapHref = `/themes/${review.themeId}/map`;

  const update = useCallback(async () => {
    const map = getWorkflowMap(review.themeId);
    const theme = getTheme(review.themeId);
    if (!map || !theme) {
      setState({ status: "noMap" });
      return;
    }
    if (map.appliedReviewIds.includes(review.id)) {
      const last = map.lastUpdate;
      setState(
        last?.reviewId === review.id && map.previous
          ? { status: "updated", summaries: last.summaries, canUndo: true }
          : { status: "already" },
      );
      return;
    }
    if (inFlight.has(review.id)) return;
    inFlight.add(review.id);
    setState({ status: "updating" });
    try {
      const { ops, workspaceSha } = await postMapUpdate({
        theme: {
          name: theme.name,
          question: theme.question,
          method: theme.method,
          evaluation: theme.evaluation,
        },
        map,
        review,
      });
      // 待っている間にマップの画面で直された分を消さないよう、読み直してから当てはめる
      const latest = getWorkflowMap(review.themeId) ?? map;
      const now = nowIso();
      if (ops.length === 0) {
        saveWorkflowMap({
          ...latest,
          appliedReviewIds: [...latest.appliedReviewIds, review.id],
          ...(workspaceSha ? { workspaceSha } : {}),
          updatedAt: now,
        });
        setState({ status: "nothing" });
        return;
      }
      const result = applyMapOps(latest, ops, review.id, now);
      saveWorkflowMap(
        workspaceSha ? { ...result.map, workspaceSha } : result.map,
      );
      setState({
        status: "updated",
        summaries: result.map.lastUpdate?.summaries ?? [],
        canUndo: true,
      });
    } catch (e) {
      setState({
        status: "error",
        message:
          e instanceof Error ? e.message : "マップを更新できませんでした。",
      });
    } finally {
      inFlight.delete(review.id);
    }
  }, [review]);

  useEffect(() => {
    void update();
  }, [update]);

  function handleUndo() {
    const map = getWorkflowMap(review.themeId);
    if (!map) return;
    const restored = undoLastUpdate(map);
    if (!restored) return;
    saveWorkflowMap(restored);
    setState({ status: "undone" });
  }

  if (state.status === "idle" || state.status === "noMap") return null;

  return (
    <section
      className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
      aria-live="polite"
    >
      {state.status === "updating" && (
        <p role="status">作業フローマップを更新しています…</p>
      )}
      {state.status === "updated" && (
        <div className="space-y-2">
          <p className="font-medium">
            作業フローマップに {state.summaries.length} 件反映しました
          </p>
          {state.summaries.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-blue-800">
              {state.summaries.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={mapHref} className="font-medium underline">
              マップを見る
            </Link>
            {state.canUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className="text-blue-700 underline"
              >
                取り消す
              </button>
            )}
          </div>
        </div>
      )}
      {state.status === "nothing" && (
        <p>
          作業フローマップに反映する変更はありませんでした。{" "}
          <Link href={mapHref} className="underline">
            マップを見る
          </Link>
        </p>
      )}
      {state.status === "already" && (
        <p>
          この判定は作業フローマップに反映済みです。{" "}
          <Link href={mapHref} className="underline">
            マップを見る
          </Link>
        </p>
      )}
      {state.status === "undone" && (
        <p>
          作業フローマップへの反映を取り消しました。{" "}
          <Link href={mapHref} className="underline">
            マップを見る
          </Link>
        </p>
      )}
      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-3">
          <p>作業フローマップを更新できませんでした：{state.message}</p>
          <button
            type="button"
            onClick={() => void update()}
            className="text-blue-700 underline"
          >
            もう一度
          </button>
        </div>
      )}
    </section>
  );
}
