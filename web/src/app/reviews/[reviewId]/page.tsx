"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getReview, updateFinding } from "@/lib/storage";
import type { FindingType, Review } from "@/lib/types";
import { FindingSection } from "@/components/review/FindingSection";
import { firstLine, shortSha } from "@/components/review/labels";

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  // undefined: 読み込み中 / null: 見つからない
  const [review, setReview] = useState<Review | null | undefined>(undefined);

  useEffect(() => {
    setReview(getReview(reviewId) ?? null);
  }, [reviewId]);

  if (review === undefined) {
    return <p className="text-sm text-gray-500">読み込み中…</p>;
  }
  if (review === null) {
    return (
      <div className="space-y-3">
        <p>判定結果が見つかりませんでした。</p>
        <Link href="/" className="text-blue-700 underline">
          研究テーマ一覧に戻る
        </Link>
      </div>
    );
  }

  const current = review;

  function handleChangeType(findingId: string, type: FindingType) {
    const patch =
      type === "hidden_problem" ? { type } : { type, saved: false };
    const updated = updateFinding(current.id, findingId, patch);
    if (updated) setReview(updated);
  }

  function handleToggleSaved(findingId: string, saved: boolean) {
    const updated = updateFinding(current.id, findingId, { saved });
    if (updated) setReview(updated);
  }

  const byType = (type: FindingType) =>
    current.findings.filter((f) => f.type === type);
  const savedCount = current.findings.filter(
    (f) => f.type === "hidden_problem" && f.saved,
  ).length;

  return (
    <div className="space-y-8 rounded-xl bg-white p-4 text-gray-900 sm:p-6">
      <header className="space-y-2">
        <Link
          href={`/themes/${current.themeId}`}
          className="text-sm text-blue-700 underline"
        >
          ← 研究テーマに戻る
        </Link>
        <h1 className="text-2xl font-bold">
          {firstLine(current.commitMessage) || "（メッセージなし）"}
        </h1>
        <p className="text-sm text-gray-500">
          コミット <code className="font-mono">{shortSha(current.commitSha)}</code>
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h2 className="text-xs font-bold text-gray-600">作業の目的</h2>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
            {current.purpose}
          </p>
        </div>
        <p className="text-xs text-gray-500">
          AIの判定は間違えることがあります。各項目の「判定を修正」で分類を直せます。
        </p>
      </header>

      <FindingSection
        type="hidden_problem"
        findings={byType("hidden_problem")}
        description="目的と違う実装の裏にある、AIが黙って対処した問題です。問題ログに保存すると、あとで見返せます。"
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="extra_addition"
        findings={byType("extra_addition")}
        description="頼んでいない追加です。知らせるだけで、保存はされません。"
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="on_purpose"
        findings={byType("on_purpose")}
        description="作業の目的に沿った変更です。"
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />

      <footer className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-600">
          問題ログに保存した問題：{savedCount} 件
        </p>
        <Link
          href={`/themes/${current.themeId}/teacher`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          先生モードで理解を確かめる
        </Link>
        <Link
          href={`/themes/${current.themeId}`}
          className="text-sm text-blue-700 underline"
        >
          問題ログを見る
        </Link>
      </footer>
    </div>
  );
}
