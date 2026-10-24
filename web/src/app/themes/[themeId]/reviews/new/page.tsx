"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCommits, fetchDiff, postReview } from "@/lib/api-client";
import type { CommitSummary } from "@/lib/api-types";
import { getTheme, newId, nowIso, saveReview } from "@/lib/storage";
import type { ResearchTheme, Review } from "@/lib/types";
import { CommitPicker } from "@/components/review/CommitPicker";
import { ThemePurposeSummary } from "@/components/review/ThemePurposeSummary";

type CommitsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; commits: CommitSummary[] };

type SubmitState =
  | { status: "idle" }
  | { status: "fetching-diff" }
  | { status: "judging" }
  | { status: "error"; message: string };

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "不明なエラーが発生しました。";
}

export default function NewReviewPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const router = useRouter();

  // undefined: 読み込み中 / null: 見つからない
  const [theme, setTheme] = useState<ResearchTheme | null | undefined>(
    undefined,
  );
  const [commits, setCommits] = useState<CommitsState>({ status: "loading" });
  const [commitsAttempt, setCommitsAttempt] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  useEffect(() => {
    setTheme(getTheme(themeId) ?? null);
  }, [themeId]);

  const repo = theme?.repo;
  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    setCommits({ status: "loading" });
    fetchCommits(repo)
      .then((res) => {
        if (!cancelled) setCommits({ status: "ready", commits: res.commits });
      })
      .catch((e) => {
        if (!cancelled) setCommits({ status: "error", message: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [repo, commitsAttempt]);

  if (theme === undefined) {
    return <p className="text-sm text-gray-500">読み込み中…</p>;
  }
  if (theme === null) {
    return (
      <div className="space-y-3">
        <p>研究テーマが見つかりませんでした。</p>
        <Link href="/" className="text-blue-700 underline">
          研究テーマ一覧に戻る
        </Link>
      </div>
    );
  }

  const busy = submit.status === "fetching-diff" || submit.status === "judging";
  const selectedCommit =
    commits.status === "ready"
      ? commits.commits.find((c) => c.sha === selectedSha)
      : undefined;
  const canSubmit = purpose.trim() !== "" && !!selectedCommit && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!theme || !selectedCommit || !canSubmit) return;
    try {
      setSubmit({ status: "fetching-diff" });
      const diff = await fetchDiff(theme.repo, selectedCommit.sha);
      setSubmit({ status: "judging" });
      const { findings } = await postReview({
        theme: {
          name: theme.name,
          question: theme.question,
          method: theme.method,
          evaluation: theme.evaluation,
        },
        purpose: purpose.trim(),
        commit: diff,
      });
      const review: Review = {
        id: newId(),
        themeId: theme.id,
        purpose: purpose.trim(),
        commitSha: selectedCommit.sha,
        commitMessage: selectedCommit.message,
        createdAt: nowIso(),
        findings,
      };
      saveReview(review);
      router.push(`/reviews/${review.id}`);
    } catch (err) {
      setSubmit({ status: "error", message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-6 rounded-xl bg-white p-4 text-gray-900 sm:p-6">
      <div>
        <Link
          href={`/themes/${theme.id}`}
          className="text-sm text-blue-700 underline"
        >
          ← {theme.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">変更を取り込んで判定する</h1>
        <p className="mt-1 text-sm text-gray-600">
          リポジトリ：<code className="font-mono">{theme.repo}</code>
        </p>
      </div>

      <ThemePurposeSummary theme={theme} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-2">
          <label htmlFor="purpose" className="block font-bold">
            作業の目的 <span className="text-sm font-normal text-red-600">必須</span>
          </label>
          <p className="text-sm text-gray-600">
            AIに何を頼んだかを書いてください。AIに渡したプロンプトをそのまま貼っても構いません。
          </p>
          <textarea
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={5}
            disabled={busy}
            placeholder="例：データを読み込んでモデルXを学習・評価するスクリプトを作る"
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
          />
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">取り込むコミット</h2>
          {commits.status === "loading" && (
            <p className="text-sm text-gray-600" role="status">
              コミットを取得中…
            </p>
          )}
          {commits.status === "error" && (
            <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
              <p className="text-red-800">
                コミットを取得できませんでした：{commits.message}
              </p>
              <button
                type="button"
                onClick={() => setCommitsAttempt((n) => n + 1)}
                className="rounded border border-red-600 px-3 py-1 text-red-700 hover:bg-red-100"
              >
                もう一度取得する
              </button>
            </div>
          )}
          {commits.status === "ready" && (
            <CommitPicker
              commits={commits.commits}
              selectedSha={selectedSha}
              onSelect={setSelectedSha}
              disabled={busy}
            />
          )}
        </section>

        <section className="space-y-3">
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            「判定する」を押すと、選んだコミットのコードの差分と、研究の目的・作業の目的が AI（Claude）に送信されます。
          </p>

          {busy && (
            <p className="text-sm font-medium text-gray-700" role="status">
              {submit.status === "fetching-diff"
                ? "コミットの差分を取得中…"
                : "AIが判定中…（数十秒かかることがあります）"}
            </p>
          )}
          {submit.status === "error" && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              判定に失敗しました：{submit.message}
              <br />
              もう一度「判定する」を押すと再試行できます。
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {busy ? "判定中…" : submit.status === "error" ? "再試行する" : "判定する"}
          </button>
        </section>
      </form>
    </div>
  );
}
