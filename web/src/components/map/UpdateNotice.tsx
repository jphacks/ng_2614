"use client";

import type { WorkflowMap } from "@/lib/types";
import { formatDate } from "@/components/theme/format";

// 直近の自動更新の内容と、取り消しのボタン
export function UpdateNotice({
  map,
  onUndo,
}: {
  map: WorkflowMap;
  onUndo: () => void;
}) {
  if (!map.previous) return null;
  const update = map.lastUpdate;
  return (
    <div className="border-y border-ink py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">
          マップを自動で更新しました
          {update && (
            <span className="ml-2 text-xs font-normal text-ink-3">
              {formatDate(update.at)}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="btn btn-sm"
        >
          直近の自動更新を取り消す
        </button>
      </div>
      {update && update.summaries.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-2">
          {update.summaries.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
