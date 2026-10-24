"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchDiff } from "@/lib/api-client";
import type { DiffResponse } from "@/lib/api-types";
import { getDiff, saveDiff } from "@/lib/diff-store";
import { getReview, getTheme, updateFinding } from "@/lib/storage";
import type { FindingType, Review } from "@/lib/types";
import { FileDiffList } from "@/components/review/DiffView";
import { FindingSection } from "@/components/review/FindingSection";
import { firstLine, headline, shortSha } from "@/components/review/labels";
import { HookReviewInfo } from "@/components/hook/HookReviewInfo";
import { MapUpdateNotice } from "@/components/review/MapUpdateNotice";
import { RejudgePanel } from "@/components/hook/RejudgePanel";

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  // undefined: 読み込み中 / null: 見つからない
  const [review, setReview] = useState<Review | null | undefined>(undefined);

  // 差分（F-14）。undefined：読み込み中 / null：保存されていない
  const [diff, setDiff] = useState<DiffResponse | null | undefined>(undefined);

  useEffect(() => {
    setReview(getReview(reviewId) ?? null);
  }, [reviewId]);

  useEffect(() => {
    let cancelled = false;
    setDiff(undefined);
    loadDiff(reviewId).then((d) => {
      if (!cancelled) setDiff(d ?? null);
    });
    return () => {
      cancelled = true;
    };
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
  // source が無いものはフック導入前のデータ（コミット）
  const isHook = current.source === "claude_code_hook";
  const earlierPrompts = current.earlierPrompts ?? [];

  function handleChangeType(findingId: string, type: FindingType) {
    const patch = type === "hidden_problem" ? { type } : { type, saved: false };
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
          {isHook
            ? headline(current.purpose) || "（依頼文なし）"
            : firstLine(current.commitMessage) || "（メッセージなし）"}
        </h1>
        <p className="text-sm text-gray-500">
          {isHook ? (
            "Claude Code の作業（未コミット）"
          ) : (
            <>
              コミット{" "}
              <code className="font-mono">{shortSha(current.commitSha)}</code>
            </>
          )}
        </p>
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div>
            <h2 className="text-xs font-bold text-gray-600">作業の目的</h2>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
              {current.purpose}
            </p>
          </div>
          {isHook && earlierPrompts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-600">
                それまでの依頼
              </h3>
              <ol className="mt-0.5 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                {earlierPrompts.map((p, i) => (
                  <li key={i} className="whitespace-pre-wrap">
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {isHook && (
            <RejudgePanel
              key={current.id}
              review={current}
              diff={diff}
              onUpdated={setReview}
            />
          )}
        </div>
        <p className="text-xs text-gray-500">
          AIの判定は間違えることがあります。各項目の「判定を修正」で分類を直せます。
        </p>
      </header>

      <MapUpdateNotice key={current.id} review={current} />

      {isHook && <HookReviewInfo review={current} />}

      <FindingSection
        type="hidden_problem"
        findings={byType("hidden_problem")}
        description="目的と違う実装の裏にある、AIが黙って対処した問題です。問題ログに保存すると、あとで見返せます。"
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="extra_addition"
        findings={byType("extra_addition")}
        description="頼んでいない追加です。知らせるだけで、保存はされません。"
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="on_purpose"
        findings={byType("on_purpose")}
        description="作業の目的に沿った変更です。"
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-gray-800">
            変更の全体
            {diff && `（${diff.files.length} ファイル）`}
          </h2>
          <p className="text-xs text-gray-500">
            AIが変えたコードの差分です。緑の行が追加、赤の行が削除です。
          </p>
        </div>
        {diff === undefined && (
          <p className="text-sm text-gray-500" role="status">
            差分を読み込み中…
          </p>
        )}
        {diff === null && (
          <p className="text-sm text-gray-500">
            この判定の差分は保存されていません。
          </p>
        )}
        {diff && (
          <>
            {diff.truncated && (
              <p className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900">
                差分が大きすぎたため、一部のファイルや行を省いています（判定も省いた状態で行っています）。
              </p>
            )}
            <FileDiffList files={diff.files} />
          </>
        )}
      </section>

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

// 保存した差分を読む。コミットから取り込んだ判定で保存されていなければ（F-14 より前のデータ）、
// GitHub から取り直して保存する
async function loadDiff(reviewId: string): Promise<DiffResponse | undefined> {
  const stored = await getDiff(reviewId);
  if (stored) return stored;
  const review = getReview(reviewId);
  if (!review || review.source === "claude_code_hook" || !review.commitSha) {
    return undefined;
  }
  const theme = getTheme(review.themeId);
  if (!theme) return undefined;
  try {
    const fetched = await fetchDiff(theme.repo, review.commitSha);
    await saveDiff(reviewId, fetched);
    return fetched;
  } catch {
    return undefined;
  }
}
