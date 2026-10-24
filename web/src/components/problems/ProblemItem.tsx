"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedProblem } from "@/lib/storage";
import { formatDate } from "@/components/theme/format";

export function ProblemItem({ problem }: { problem: SavedProblem }) {
  const { review, finding } = problem;
  const [open, setOpen] = useState(false);
  const impact = finding.researchImpact;
  const hasImpact = impact?.exists === true;

  return (
    <li
      className={`rounded-md border p-4 ${
        hasImpact ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{finding.summary}</p>
          <p className="mt-1 text-xs text-gray-500">
            {formatDate(review.createdAt)}
          </p>
        </div>
        {hasImpact && (
          <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
            研究への影響あり
          </span>
        )}
      </div>

      {hasImpact && (
        <p className="mt-3 rounded border border-red-300 bg-white p-3 text-sm text-red-900">
          <span className="font-bold">⚠ 研究への影響: </span>
          {impact.description}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 text-sm text-blue-700 hover:underline"
      >
        {open ? "詳細を閉じる" : "詳細を見る"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <Detail label="エラー内容">
            {finding.error ?? "(記録なし)"}
            {finding.errorIsInferred && (
              <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                推測
              </span>
            )}
          </Detail>
          <Detail label="対処方法">{finding.fix ?? "(記録なし)"}</Detail>
          {!hasImpact && (
            <Detail label="研究への影響">
              {impact?.description || "なし"}
            </Detail>
          )}
          {finding.files.length > 0 && (
            <Detail label="関係するファイル">
              <ul className="space-y-0.5">
                {finding.files.map((file) => (
                  <li key={file} className="font-mono text-xs">
                    {file}
                  </li>
                ))}
              </ul>
            </Detail>
          )}
          <Link
            href={`/reviews/${review.id}`}
            className="inline-block text-blue-700 hover:underline"
          >
            この判定結果を見る →
          </Link>
        </div>
      )}
    </li>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-0.5 whitespace-pre-wrap text-gray-900">{children}</div>
    </div>
  );
}
