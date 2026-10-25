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
    <details className="border-t border-hair pt-3 text-sm">
      <summary className="cursor-pointer text-ink-2">
        却下したもの（{rejected.length}件）
      </summary>
      {rejected.length === 0 ? (
        <p className="mt-2 text-xs text-ink-3">
          消したタスクはありません。消したものは、ここに残ります。
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-hair border-y border-hair">
          {rejected.map((r, i) => (
            <li
              key={`${r.at}-${i}`}
              className="flex flex-wrap items-start justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{r.title}</p>
                <p className="text-xs text-ink-3">
                  {formatDate(r.at)}
                  {r.tasks.length > 1 &&
                    `・サブタスク ${r.tasks.length - 1}件を含む`}
                </p>
                {r.reason && (
                  <p className="text-xs text-ink-2">理由：{r.reason}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRestore(i)}
                className="btn btn-sm shrink-0"
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
