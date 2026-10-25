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
    return <p className="text-sm text-ink-3">読み込み中…</p>;
  }
  if (review === null) {
    return (
      <div className="space-y-3">
        <p>判定結果が見つかりませんでした。</p>
        <Link href="/" className="link">
          プロジェクト一覧に戻る
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
    <div className="space-y-10">
      <header className="space-y-2">
        <Link
          href={`/themes/${current.themeId}`}
          className="link-quiet text-sm"
        >
          ← プロジェクトに戻る
        </Link>
        <h1 className="text-2xl leading-snug">
          {isHook
            ? headline(current.purpose) || "（依頼文なし）"
            : firstLine(current.commitMessage) || "（メッセージなし）"}
        </h1>
        <p className="text-sm text-ink-3">
          {isHook ? (
            "Claude Code の作業（未コミット）"
          ) : (
            <>
              コミット{" "}
              <code className="font-mono">{shortSha(current.commitSha)}</code>
            </>
          )}
        </p>
        <div className="space-y-3 border-y border-ink py-3">
          <div>
            <h2 className="font-sans text-xs font-bold text-ink-2">作業の目的</h2>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
              {current.purpose}
            </p>
          </div>
          {isHook && earlierPrompts.length > 0 && (
            <div>
              <h3 className="font-sans text-xs font-bold text-ink-2">
                それまでの依頼
              </h3>
              <ol className="mt-0.5 list-decimal space-y-1 pl-5 text-sm text-ink-2">
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
      </header>

      <MapUpdateNotice key={current.id} review={current} />

      {isHook && <HookReviewInfo review={current} />}

      <FindingSection
        type="hidden_problem"
        findings={byType("hidden_problem")}
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="extra_addition"
        findings={byType("extra_addition")}
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />
      <FindingSection
        type="on_purpose"
        findings={byType("on_purpose")}
        diff={diff}
        onChangeType={handleChangeType}
        onToggleSaved={handleToggleSaved}
      />

      <section className="space-y-3">
        <h2 className="rule-head text-base text-ink-2">
          変更の全体
          {diff && `（${diff.files.length} ファイル）`}
        </h2>
        {diff === undefined && (
          <p className="text-sm text-ink-3" role="status">
            差分を読み込み中…
          </p>
        )}
        {diff === null && (
          <p className="text-sm text-ink-3">
            この判定の差分は保存されていません。
          </p>
        )}
        {diff && (
          <>
            {diff.truncated && (
              <p className="text-xs">
                <span className="marker">
                  差分が大きすぎたため、一部のファイルや行を省いています（判定も省いた状態で行っています）。
                </span>
              </p>
            )}
            <FileDiffList files={diff.files} />
          </>
        )}
      </section>

      <footer className="flex flex-wrap items-center gap-4 border-t border-ink pt-4">
        <p className="text-sm text-ink-2">
          問題ログに保存した問題：{savedCount} 件
        </p>
        <Link
          href={`/themes/${current.themeId}/teacher`}
          className="btn-primary"
        >
          先生モードで理解を確かめる
        </Link>
        <Link
          href={`/themes/${current.themeId}`}
          className="link text-sm"
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
