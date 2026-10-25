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
    // 研究への影響ありの問題は、左の余白に赤ペンの縦線を引く
    <li
      className={`border-l-2 py-4 pl-3 ${
        hasImpact ? "border-pen" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{finding.summary}</p>
          <p className="mt-1 text-xs text-ink-3">
            {formatDate(review.createdAt)}
          </p>
        </div>
        {hasImpact && (
          <span className="shrink-0 text-xs font-bold text-pen">
            研究への影響あり
          </span>
        )}
      </div>

      {hasImpact && (
        <p className="mt-3 text-sm text-ink">
          <span className="font-bold text-pen">⚠ 研究への影響: </span>
          {impact.description}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="link mt-3 text-sm"
      >
        {open ? "詳細を閉じる" : "詳細を見る"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <Detail label="エラー内容">
            {finding.error ?? "(記録なし)"}
            {finding.errorIsInferred && (
              <span className="marker ml-2 text-xs">
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
            className="link inline-block"
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
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <div className="mt-0.5 whitespace-pre-wrap text-ink">{children}</div>
    </div>
  );
}
