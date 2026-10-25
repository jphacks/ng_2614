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
import { startMapUpdate } from "@/lib/map/auto-update";
import { findThemeByRepo, newId, nowIso, saveHookReview } from "@/lib/storage";
import type { Review } from "@/lib/types";
import { headline } from "@/components/review/labels";

// Claude Code のフック（F-13）で届いた変更の知らせ。全画面の右下にトーストで出す

const POLL_MS = 3000;
const MAX_VISIBLE = 3;
const MAX_KEPT = 20;

type Notice =
  | { id: string; kind: "unregistered"; repo: string }
  | { id: string; kind: "judging"; title: string; startedAt: number }
  | {
      id: string;
      kind: "done";
      title: string;
      reviewId: string;
      hidden: number;
      impact: number; // 隠れた問題のうち、研究への影響ありの数
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
      upsert({ id: change.id, kind: "judging", title, startedAt: Date.now() });
      try {
        const theme = findThemeByRepo(change.repo);
        if (!theme) throw new Error("プロジェクトが見つかりません。");
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
        startMapUpdate(review); // 待たない
        await saveDiff(review.id, commit);
        upsert({
          id: change.id,
          kind: "done",
          title,
          reviewId: review.id,
          hidden: findings.filter((f) => f.type === "hidden_problem").length,
          impact: findings.filter(
            (f) => f.type === "hidden_problem" && f.researchImpact?.exists,
          ).length,
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
      upsert({
        id,
        kind: "judging",
        title: titleOf(prompt),
        startedAt: Date.now(),
      });
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

  function dismissAll() {
    for (const n of notices) dismissed.current.add(n.id);
    setNotices((prev) => prev.filter((n) => n.kind === "judging"));
  }

  // 判定中の経過秒数を出すため、判定中の知らせがあるあいだ 1 秒ごとに描き直す
  const judging = notices.some((n) => n.kind === "judging");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!judging) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [judging]);

  if (notices.length === 0) return null;
  // notices は新しい順。画面では新しいものを下に置く
  const visible = notices.slice(0, MAX_VISIBLE).reverse();
  const older = notices.length - visible.length;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:right-[calc(var(--map-side-w,0px)+1rem)]"
    >
      {older > 0 && (
        <div className="float-sheet flex items-center justify-between px-3 py-1.5 text-xs text-ink-2">
          <span>ほか {older} 件の知らせ</span>
          <button
            type="button"
            onClick={dismissAll}
            className="link"
          >
            すべて閉じる
          </button>
        </div>
      )}
      {visible.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`float-sheet flex items-start gap-3 p-3 text-sm text-ink ${ACCENT[toneOf(n)]}`}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <NoticeBody notice={n} now={now} onRetry={retry} />
          </div>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="閉じる"
            className="-mr-1 -mt-1 shrink-0 px-1.5 text-lg leading-none text-ink-3 hover:bg-paper-2 hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

type Tone = "info" | "ok" | "warn" | "danger";

// 左の太い線で、知らせの種類を分ける。判定中は藍、問題なしは若葉、研究への影響あり・失敗は赤ペン、注意は蛍光ペン
const ACCENT: Record<Tone, string> = {
  info: "border-l-4 border-l-accent",
  ok: "border-l-4 border-l-mint",
  warn: "border-l-4 border-l-marker",
  danger: "border-l-4 border-l-pen",
};

function toneOf(n: Notice): Tone {
  switch (n.kind) {
    case "judging":
      return "info";
    case "unregistered":
      return "warn";
    case "error":
      return "danger";
    case "done":
      return n.impact > 0 ? "danger" : n.hidden > 0 ? "warn" : "ok";
  }
}

function NoticeBody({
  notice,
  now,
  onRetry,
}: {
  notice: Notice;
  now: number;
  onRetry: (change: HookChange) => void;
}) {
  switch (notice.kind) {
    case "unregistered":
      return (
        <>
          <p className="text-xs font-medium">
            <span className="marker">プロジェクトが未登録です</span>
          </p>
          <p className="break-words">
            {notice.repo
              ? `Claude Code から ${notice.repo} の変更が届きましたが、このリポジトリのプロジェクトが無いため判定できません。`
              : "Claude Code から変更が届きましたが、リポジトリを特定できなかったため判定できません。"}
          </p>
          <Link
            href={
              notice.repo
                ? `/projects/new?repo=${encodeURIComponent(notice.repo)}`
                : "/projects/new"
            }
            className="btn btn-sm"
          >
            プロジェクトを登録する
          </Link>
        </>
      );
    case "judging": {
      const sec = Math.max(0, Math.floor((now - notice.startedAt) / 1000));
      return (
        <>
          <p className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent-soft border-t-accent"
            />
            Claude Code の作業を判定中… {sec} 秒
          </p>
          <p className="break-words">{notice.title}</p>
        </>
      );
    }
    case "done":
      return (
        <>
          <p
            className={`text-xs font-medium ${
              notice.impact > 0
                ? "text-pen"
                : notice.hidden > 0
                  ? "text-ink"
                  : "text-mint-ink"
            }`}
          >
            {notice.impact > 0
              ? `研究への影響あり ${notice.impact} 件・隠れた問題 ${notice.hidden} 件`
              : notice.hidden > 0
                ? `隠れた問題 ${notice.hidden} 件`
                : "隠れた問題はありません"}
            {notice.extra > 0 && `・余計な追加 ${notice.extra} 件`}
          </p>
          <p className="break-words">{notice.title}</p>
          <Link
            href={`/reviews/${notice.reviewId}`}
            className="btn btn-sm"
          >
            結果を見る
          </Link>
        </>
      );
    case "error":
      return (
        <>
          <p className="text-xs font-medium text-pen">判定に失敗しました</p>
          <p className="break-words">{notice.title}</p>
          <p className="break-words text-xs text-ink-2">{notice.message}</p>
          <button
            type="button"
            onClick={() => onRetry(notice.change)}
            className="btn-pen btn-sm"
          >
            もう一度判定する
          </button>
        </>
      );
  }
}
