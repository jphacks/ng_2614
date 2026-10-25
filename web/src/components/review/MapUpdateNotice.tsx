"use client";

// 判定結果の画面（S-3）で、作業フローマップ（F-15）の自動更新の結果を知らせる（場面3）。
// 更新そのものは、判定を保存したときに lib/map/auto-update.ts の startMapUpdate が始めている。
// ここはその状態（更新中・反映した内容・反映なし・失敗）を見せ、取り消しを受け付けるだけ。
// そのプロジェクトのマップが無いときは何も出さない

import Link from "next/link";
import { useState } from "react";
import { undoLastUpdate } from "@/lib/map/apply";
import { useMapUpdateStatus } from "@/lib/map/auto-update";
import { getWorkflowMap, saveWorkflowMap } from "@/lib/storage";
import type { Review } from "@/lib/types";

export function MapUpdateNotice({ review }: { review: Review }) {
  const status = useMapUpdateStatus(review.id);
  const [undone, setUndone] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const mapHref = `/themes/${review.themeId}/map`;

  function handleUndo() {
    const map = getWorkflowMap(review.themeId);
    if (!map) return;
    try {
      const restored = undoLastUpdate(map);
      if (!restored) {
        setUndoError("取り消せる自動更新がありません。");
        return;
      }
      saveWorkflowMap(restored);
      setUndone(true);
      setUndoError(null);
    } catch (e) {
      setUndoError(
        e instanceof Error ? e.message : "取り消せませんでした。",
      );
    }
  }

  if (status.state === "none") return null;

  return (
    <section
      className="border-y border-hair py-3 text-sm text-ink"
      aria-live="polite"
    >
      {status.state === "running" && (
        <p role="status">作業フローマップを更新しています…</p>
      )}
      {status.state === "done" && undone && (
        <p>
          作業フローマップへの反映を取り消しました。{" "}
          <Link href={mapHref} className="link">
            マップを見る
          </Link>
        </p>
      )}
      {status.state === "done" && !undone && status.summaries.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium">
            作業フローマップに {status.summaries.length} 件反映しました
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-2">
            {status.summaries.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href={mapHref} className="link font-medium">
              マップを見る
            </Link>
            {status.canUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className="link-quiet"
              >
                取り消す
              </button>
            )}
          </div>
        </div>
      )}
      {status.state === "done" && !undone && status.summaries.length === 0 && (
        <p>
          作業フローマップに反映する変更はありませんでした。{" "}
          <Link href={mapHref} className="link">
            マップを見る
          </Link>
        </p>
      )}
      {status.state === "error" && (
        <div className="space-y-1">
          <p>作業フローマップを更新できませんでした：{status.message}</p>
          <Link href={mapHref} className="link">
            マップを見る
          </Link>
        </div>
      )}
      {undoError && (
        <p role="alert" className="mt-2 text-xs text-pen">
          {undoError}
        </p>
      )}
    </section>
  );
}
