"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCommits, fetchDiff, postReview } from "@/lib/api-client";
import type { CommitSummary } from "@/lib/api-types";
import { saveDiff } from "@/lib/diff-store";
import { startMapUpdate } from "@/lib/map/auto-update";
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
  // 「判定する」を押したのに足りないものがあったか（足りないものを知らせる）
  const [triedSubmit, setTriedSubmit] = useState(false);

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
    return <p className="text-sm text-ink-3">読み込み中…</p>;
  }
  if (theme === null) {
    return (
      <div className="space-y-3">
        <p>プロジェクトが見つかりませんでした。</p>
        <Link href="/" className="link">
          プロジェクト一覧に戻る
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
  // ボタンは押せないようにせず、押したときに足りないものを出す（埋まったら消える）
  const missing = [
    ...(purpose.trim() === "" ? ["作業の目的を書いてください。"] : []),
    ...(!selectedCommit ? ["取り込むコミットを選んでください。"] : []),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!theme || !selectedCommit || !canSubmit) {
      setTriedSubmit(true);
      if (purpose.trim() === "") document.getElementById("purpose")?.focus();
      return;
    }
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
      startMapUpdate(review); // 待たない。結果は S-3 の知らせで見せる
      await saveDiff(review.id, diff);
      router.push(`/reviews/${review.id}`);
    } catch (err) {
      setSubmit({ status: "error", message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-6 bg-paper p-4 text-ink sm:p-6">
      <div>
        <Link
          href={`/themes/${theme.id}`}
          className="link-quiet text-sm"
        >
          ← {theme.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">コミットから取り込んで判定する</h1>
        <p className="mt-1 text-sm text-ink-2">
          リポジトリ：<code className="font-mono">{theme.repo}</code>
        </p>
      </div>

      <ThemePurposeSummary theme={theme} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-2">
          <label htmlFor="purpose" className="block font-bold">
            作業の目的 <span className="text-sm font-normal text-ink-3">必須</span>
          </label>
          <textarea
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={5}
            disabled={busy}
            placeholder="AI に頼んだこと（プロンプトをそのまま貼ってもよい）"
            className="field p-3"
          />
        </section>

        <section className="space-y-2">
          <h2 className="rule-head font-bold">取り込むコミット</h2>
          {commits.status === "loading" && (
            <p className="text-sm text-ink-2" role="status">
              コミットを取得中…
            </p>
          )}
          {commits.status === "error" && (
            <div className="space-y-2 border-l-2 border-pen p-3 text-sm">
              <p className="text-pen">
                コミットを取得できませんでした：{commits.message}
              </p>
              <button
                type="button"
                onClick={() => setCommitsAttempt((n) => n + 1)}
                className="btn btn-sm"
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
          <p className="border-l-2 border-ink py-1 pl-3 text-sm text-ink-2">
            「判定する」を押すと、選んだコミットのコードの差分と、研究の目的・作業の目的が AI（Claude）に送信されます。
          </p>

          {busy && (
            <p className="text-sm font-medium text-ink-2" role="status">
              {submit.status === "fetching-diff"
                ? "コミットの差分を取得中…"
                : "AIが判定中…（数十秒かかることがあります）"}
            </p>
          )}
          {submit.status === "error" && (
            <div className="border-l-2 border-pen p-3 text-sm text-pen">
              判定に失敗しました：{submit.message}
              <br />
              もう一度「判定する」を押すと再試行できます。
            </div>
          )}

          {triedSubmit && !busy && missing.length > 0 && (
            <ul role="alert" className="space-y-0.5 text-sm text-pen">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary px-5"
          >
            {busy ? "判定中…" : submit.status === "error" ? "再試行する" : "判定する"}
          </button>
        </section>
      </form>
    </div>
  );
}
