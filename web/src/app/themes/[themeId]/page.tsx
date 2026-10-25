"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getTheme,
  listReviews,
  listSavedProblems,
  REVIEWS_CHANGED_EVENT,
  saveTheme,
  type SavedProblem,
} from "@/lib/storage";
import type { ResearchTheme, Review } from "@/lib/types";
import { ProblemLog } from "@/components/problems/ProblemLog";
import { DeleteProject } from "@/components/theme/DeleteProject";
import { HookIntake } from "@/components/theme/HookIntake";
import { PurposeView } from "@/components/theme/PurposeView";
import { ReviewList } from "@/components/theme/ReviewList";
import { ThemeForm, type ThemeFormValues } from "@/components/theme/ThemeForm";

type Loaded =
  | { status: "loading" }
  | { status: "notFound" }
  | {
      status: "ready";
      theme: ResearchTheme;
      reviews: Review[];
      problems: SavedProblem[];
    };

function load(themeId: string): Loaded {
  const theme = getTheme(themeId);
  if (!theme) return { status: "notFound" };
  return {
    status: "ready",
    theme,
    reviews: listReviews(themeId),
    problems: listSavedProblems(themeId),
  };
}

// S-4 研究テーマの詳細・問題ログ
export default function ThemeDetailPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setState(load(themeId));
  }, [themeId]);

  // フックで判定が届いたら、一覧を読み直す
  useEffect(() => {
    const reload = () => setState(load(themeId));
    window.addEventListener(REVIEWS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, reload);
  }, [themeId]);

  if (state.status === "loading") {
    return <p className="text-sm text-ink-3">読み込み中...</p>;
  }
  if (state.status === "notFound") {
    return (
      <div>
        <p className="text-ink-2">プロジェクトが見つかりません。</p>
        <Link
          href="/"
          className="link mt-2 inline-block"
        >
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  const { theme, reviews, problems } = state;

  const handleSave = (values: ThemeFormValues) => {
    saveTheme({ ...theme, ...values });
    setState(load(themeId));
    setEditing(false);
  };

  return (
    <div className="space-y-10">
      <div>
        <Link href="/" className="link-quiet text-sm">
          ← プロジェクト一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">{theme.name}</h1>
        <p className="mt-1 font-mono text-xs text-ink-3">{theme.repo}</p>
        <div className="mt-4">
          <HookIntake />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/themes/${theme.id}/teacher`}
            className="btn"
          >
            先生モード
          </Link>
          <Link
            href={`/themes/${theme.id}/map`}
            className="btn"
          >
            作業フローマップ
          </Link>
          {/* 取り込みの主な方法はフックなので、コミットからの取り込みは目立たない副ボタンにする */}
          <Link
            href={`/themes/${theme.id}/reviews/new`}
            className="btn btn-sm"
          >
            コミットから取り込む
          </Link>
        </div>
      </div>

      {/* 広い画面（1280px 以上）では2列。左に研究の目的と問題ログ、右に取り込んだ変更 */}
      <div className="space-y-10 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-10 xl:space-y-0">
        <div className="space-y-10">
          <section>
            <div className="rule-head flex items-center justify-between">
              <h2 className="text-lg font-bold">研究の目的</h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="link text-sm"
                >
                  編集する
                </button>
              )}
            </div>
            <div className="mt-3">
              {editing ? (
                <ThemeForm
                  initial={{
                    name: theme.name,
                    repo: theme.repo,
                    question: theme.question,
                    method: theme.method,
                    evaluation: theme.evaluation,
                  }}
                  submitLabel="保存する"
                  onSubmit={handleSave}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <PurposeView theme={theme} />
              )}
            </div>
          </section>

          <section>
            <h2 className="rule-head text-lg font-bold">問題ログ</h2>
            <div className="mt-3">
              <ProblemLog problems={problems} />
            </div>
          </section>
        </div>
        <section>
          <h2 className="rule-head text-lg font-bold">取り込んだ変更</h2>
          <div className="mt-3">
            <ReviewList reviews={reviews} />
          </div>
        </section>
      </div>

      <DeleteProject
        theme={theme}
        reviewCount={reviews.length}
        problemCount={problems.length}
      />
    </div>
  );
}
