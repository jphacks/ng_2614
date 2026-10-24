"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getTheme,
  listReviews,
  listSavedProblems,
  saveTheme,
  type SavedProblem,
} from "@/lib/storage";
import type { ResearchTheme, Review } from "@/lib/types";
import { ProblemLog } from "@/components/problems/ProblemLog";
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

  if (state.status === "loading") {
    return <p className="text-sm text-gray-500">読み込み中...</p>;
  }
  if (state.status === "notFound") {
    return (
      <div>
        <p className="text-gray-700">研究テーマが見つかりません。</p>
        <Link
          href="/"
          className="mt-2 inline-block text-blue-700 hover:underline"
        >
          研究テーマ一覧へ戻る
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
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← 研究テーマ一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">{theme.name}</h1>
        <p className="mt-1 font-mono text-xs text-gray-500">{theme.repo}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/themes/${theme.id}/reviews/new`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            変更を取り込む
          </Link>
          <Link
            href={`/themes/${theme.id}/teacher`}
            className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            先生モード
          </Link>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">研究の目的</h2>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-blue-700 hover:underline"
            >
              編集する
            </button>
          )}
        </div>
        <div className="mt-3 rounded-md border border-gray-200 p-4">
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
        <h2 className="text-lg font-bold">問題ログ</h2>
        <p className="mt-1 text-sm text-gray-600">
          AI が黙って対処していた問題の記録です（新しい順）。先生との打ち合わせの前に見返せます。
        </p>
        <div className="mt-3">
          <ProblemLog problems={problems} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">取り込んだ変更</h2>
        <div className="mt-3">
          <ReviewList reviews={reviews} />
        </div>
      </section>
    </div>
  );
}
