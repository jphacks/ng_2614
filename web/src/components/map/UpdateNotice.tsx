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
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-blue-900">
          マップを自動で更新しました
          {update && (
            <span className="ml-2 text-xs font-normal text-blue-800">
              {formatDate(update.at)}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-md border border-blue-600 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          直近の自動更新を取り消す
        </button>
      </div>
      {update && update.summaries.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-blue-900">
          {update.summaries.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
