"use client";

import type { MapRejected } from "@/lib/types";
import { formatDate } from "@/components/theme/format";

// 人が消したもの・却下したものの一覧（折りたたみ）。「戻す」で元に戻せる
export function RejectedList({
  rejected,
  onRestore,
}: {
  rejected: MapRejected[];
  onRestore: (index: number) => void;
}) {
  return (
    <details className="rounded-md border border-gray-200 p-3 text-sm">
      <summary className="cursor-pointer text-gray-700">
        却下したもの（{rejected.length}件）
      </summary>
      {rejected.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          消したタスクはありません。消したものは、ここに残ります。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rejected.map((r, i) => (
            <li
              key={`${r.at}-${i}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded border border-gray-200 p-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{r.title}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(r.at)}
                  {r.tasks.length > 1 &&
                    `・サブタスク ${r.tasks.length - 1}件を含む`}
                </p>
                {r.reason && (
                  <p className="text-xs text-gray-600">理由：{r.reason}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRestore(i)}
                className="shrink-0 rounded-md border border-blue-600 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                戻す
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
