"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  fetchHookChanges,
  postReview,
  takeHookChange,
} from "@/lib/api-client";
import type { DiffResponse, HookChange } from "@/lib/api-types";
import { buildHookReviewRequest, hookPurpose } from "@/lib/hook-review";
import { saveDiff } from "@/lib/diff-store";
import { findThemeByRepo, newId, nowIso, saveHookReview } from "@/lib/storage";
import type { Review } from "@/lib/types";
import { headline } from "@/components/review/labels";

// Claude Code のフック（F-13）で届いた変更の知らせ。全画面のヘッダーの下に出す

const POLL_MS = 3000;
const MAX_VISIBLE = 5;
const MAX_KEPT = 20;

type Notice =
  | { id: string; kind: "unregistered"; repo: string }
  | { id: string; kind: "judging"; title: string }
  | {
      id: string;
      kind: "done";
      title: string;
      reviewId: string;
      hidden: number;
      extra: number;
    }
  | {
      id: string;
      kind: "error";
      title: string;
      message: string;
      change: HookChange;
    };

function titleOf(prompt: string): string {
  return headline(prompt) || "依頼文なし";
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "不明なエラーが発生しました。";
}

export function HookInbox() {
  const [notices, setNotices] = useState<Notice[]>([]);
  // このタブで扱い始めた変更の id（二重に取り出さない）
  const seen = useRef(new Set<string>());
  // 閉じた「未登録」の知らせ（再確認で復活させない）
  const dismissed = useRef(new Set<string>());
  // 判定は1件ずつ進める
  const chain = useRef<Promise<void>>(Promise.resolve());
  const polling = useRef(false);

  // 同じ id の知らせは置き換え、無ければ先頭（新しい順）に足す
  const upsert = useCallback((notice: Notice) => {
    setNotices((prev) =>
      prev.some((n) => n.id === notice.id)
        ? prev.map((n) => (n.id === notice.id ? notice : n))
        : [notice, ...prev].slice(0, MAX_KEPT),
    );
  }, []);

  const judge = useCallback(
    async (change: HookChange) => {
      const title = titleOf(change.prompt);
      upsert({ id: change.id, kind: "judging", title });
      try {
        const theme = findThemeByRepo(change.repo);
        if (!theme) throw new Error("研究テーマが見つかりません。");
        const purpose = hookPurpose(change.prompt, change.earlierPrompts);
        const commit: DiffResponse = {
          sha: "",
          message: "",
          url: "",
          files: change.files,
          truncated: change.truncated,
        };
        const { findings } = await postReview(
          buildHookReviewRequest(theme, purpose, commit, {
            earlierPrompts: change.earlierPrompts,
            observedErrors: change.observedErrors,
            generatedFiles: change.generatedFiles,
            headMoved: change.headMoved,
            aiReport: change.aiReport,
          }),
        );
        const review: Review = {
          id: newId(),
          themeId: theme.id,
          source: "claude_code_hook",
          purpose,
          commitSha: "",
          commitMessage: "",
          earlierPrompts: change.earlierPrompts,
          observedErrors: change.observedErrors, // 保存時に500文字へ切られる
          generatedFiles: change.generatedFiles,
          headMoved: change.headMoved,
          aiReport: change.aiReport,
          createdAt: nowIso(),
          findings,
        };
        saveHookReview(review);
        await saveDiff(review.id, commit);
        upsert({
          id: change.id,
          kind: "done",
          title,
          reviewId: review.id,
          hidden: findings.filter((f) => f.type === "hidden_problem").length,
          extra: findings.filter((f) => f.type === "extra_addition").length,
        });
      } catch (e) {
        upsert({
          id: change.id,
          kind: "error",
          title,
          message: errorMessage(e),
          change,
        });
      }
    },
    [upsert],
  );

  const enqueue = useCallback((task: () => Promise<void>) => {
    chain.current = chain.current.then(task).catch(() => {});
  }, []);

  const handle = useCallback(
    (id: string, prompt: string) => {
      seen.current.add(id);
      upsert({ id, kind: "judging", title: titleOf(prompt) });
      enqueue(async () => {
        let change: HookChange;
        try {
          change = (await takeHookChange(id)).change;
        } catch (e) {
          setNotices((prev) => prev.filter((n) => n.id !== id));
          // 404 はほかのタブが先に取り出した。それ以外は受け取り箱に残っているので、次の確認でやり直す
          if (!(e instanceof ApiRequestError && e.status === 404)) {
            seen.current.delete(id);
          }
          return;
        }
        await judge(change);
      });
    },
    [enqueue, judge, upsert],
  );

  const poll = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const res = await fetchHookChanges();
      if (!res.enabled) return;
      const unregistered: Notice[] = [];
      for (const c of res.changes) {
        if (seen.current.has(c.id)) continue;
        if (findThemeByRepo(c.repo)) {
          handle(c.id, c.prompt);
        } else if (!dismissed.current.has(c.id)) {
          unregistered.push({ id: c.id, kind: "unregistered", repo: c.repo });
        }
      }
      // 受け取り箱に残っていて、まだ取り出していない変更
      const waiting = new Set(
        res.changes.filter((c) => !seen.current.has(c.id)).map((c) => c.id),
      );
      setNotices((prev) => {
        // 箱から消えた、または登録されて判定に回った「未登録」の知らせは外す
        const kept = prev.filter(
          (n) => n.kind !== "unregistered" || waiting.has(n.id),
        );
        const have = new Set(kept.map((n) => n.id));
        // 届いた順の逆（新しい順）に先頭へ足す
        const added = unregistered.filter((n) => !have.has(n.id)).reverse();
        return [...added, ...kept].slice(0, MAX_KEPT);
      });
    } catch {
      // 静かに失敗する（アプリが止まっているときなど）
    } finally {
      polling.current = false;
    }
  }, [handle]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void poll();
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll]);

  function dismiss(id: string) {
    dismissed.current.add(id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }

  function retry(change: HookChange) {
    enqueue(() => judge(change));
  }

  const visible = notices.slice(0, MAX_VISIBLE);
  if (visible.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-2 px-4 pt-4">
      {visible.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
            n.kind === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : n.kind === "done"
                ? "border-green-300 bg-green-50 text-green-900"
                : n.kind === "unregistered"
                  ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <NoticeBody notice={n} onRetry={retry} />
          </div>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="閉じる"
            className="shrink-0 px-1 text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function NoticeBody({
  notice,
  onRetry,
}: {
  notice: Notice;
  onRetry: (change: HookChange) => void;
}) {
  switch (notice.kind) {
    case "unregistered":
      return (
        <>
          <p>
            {notice.repo
              ? `Claude Code から変更が届いています（リポジトリ：${notice.repo}）。この研究テーマが登録されていないため判定できません。`
              : "Claude Code から変更が届いていますが、リポジトリを特定できなかったため判定できません。"}
          </p>
          <Link href="/" className="text-blue-700 underline">
            研究テーマを登録する
          </Link>
        </>
      );
    case "judging":
      return <p>Claude Code の作業を判定中…（{notice.title}）</p>;
    case "done":
      return (
        <>
          <p className="break-words font-medium">
            判定できました：{notice.title}
          </p>
          <p>
            隠れた問題 {notice.hidden} 件・余計な追加 {notice.extra} 件
            <Link
              href={`/reviews/${notice.reviewId}`}
              className="ml-3 text-blue-700 underline"
            >
              結果を見る
            </Link>
          </p>
        </>
      );
    case "error":
      return (
        <>
          <p className="break-words">
            判定に失敗しました（{notice.title}）：{notice.message}
          </p>
          <button
            type="button"
            onClick={() => onRetry(notice.change)}
            className="rounded border border-red-600 px-3 py-1 text-red-700 hover:bg-red-100"
          >
            もう一度判定する
          </button>
        </>
      );
  }
}
