"use client";

import { useState } from "react";
import { postReview } from "@/lib/api-client";
import { buildHookReviewRequest } from "@/lib/hook-review";
import type { DiffResponse } from "@/lib/api-types";
import { getTheme, notifyReviewsChanged, saveReview } from "@/lib/storage";
import type { Review } from "@/lib/types";

// フック（F-13）の判定を、作業の目的を直してもう一度判定する

type Props = {
  review: Review;
  diff: DiffResponse | null | undefined; // undefined：読み込み中 / null：保存されていない
  onUpdated: (review: Review) => void;
};

export function RejudgePanel({ review, diff, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState(review.purpose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (diff === undefined) return null;
  if (diff === null) {
    return (
      <p className="text-xs text-gray-500">
        この判定の差分が保存されていないため、判定し直せません。
      </p>
    );
  }
  const savedDiff = diff;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        作業の目的を直して判定し直す
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = purpose.trim();
    if (!next || busy) return;
    const theme = getTheme(review.themeId);
    if (!theme) {
      setError("研究テーマが見つかりません。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { findings } = await postReview(
        buildHookReviewRequest(theme, next, savedDiff, {
          earlierPrompts: review.earlierPrompts ?? [],
          observedErrors: review.observedErrors ?? [],
          generatedFiles: review.generatedFiles ?? [],
          headMoved: review.headMoved ?? false,
        }),
      );
      // 同じ id のまま、目的と判定を差し替える（保存済みの印は付け直し）
      const updated = saveReview({ ...review, purpose: next, findings });
      notifyReviewsChanged();
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "不明なエラーが発生しました。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="rejudge-purpose" className="block text-sm font-bold">
        作業の目的
      </label>
      <p className="text-xs text-gray-600">
        直した目的で判定し直すと、今の判定は置き換わります（問題ログへの保存も外れます）。
      </p>
      <textarea
        id="rejudge-purpose"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        rows={5}
        disabled={busy}
        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
      />
      {busy && (
        <p className="text-sm font-medium text-gray-700" role="status">
          AIが判定中…（数十秒かかることがあります）
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          判定に失敗しました：{error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || purpose.trim() === ""}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {busy ? "判定中…" : "この目的で判定し直す"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setPurpose(review.purpose);
          }}
          disabled={busy}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
