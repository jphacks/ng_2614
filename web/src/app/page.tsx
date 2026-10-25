"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ProjectList,
  type ProjectCard,
} from "@/components/project/ProjectList";
import { fetchConnections } from "@/lib/api-client";
import { demoTheme } from "@/lib/demo/data";
import { useDemoMode } from "@/lib/demo/mode";
import {
  listReviews,
  listSavedProblems,
  listThemes,
  saveTheme,
} from "@/lib/storage";

// S-1 プロジェクトの選択（ホーム）
export default function Home() {
  const [projects, setProjects] = useState<ProjectCard[] | null>(null);
  const router = useRouter();
  const demoMode = useDemoMode();
  const [missingKey, setMissingKey] = useState(false);

  // Claude API キーが無ければ、設定画面へ案内する（F-18）。デモモードでは AI を呼ばないので出さない
  useEffect(() => {
    if (demoMode) {
      setMissingKey(false);
      return;
    }
    let cancelled = false;
    fetchConnections()
      .then((c) => {
        if (!cancelled) setMissingKey(c.anthropic.source === null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  useEffect(() => {
    setProjects(
      listThemes().map((theme) => {
        const reviews = listReviews(theme.id); // 新しい順
        return {
          theme,
          reviewCount: reviews.length,
          savedProblemCount: listSavedProblems(theme.id).length,
          lastImportedAt: reviews[0]?.createdAt,
        };
      }),
    );
  }, []);

  const handleCreateDemo = () => {
    saveTheme({ ...demoTheme, updatedAt: "" });
    router.push(`/themes/${demoTheme.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">プロジェクト</h1>
          {/* 使い方（S-9）への入り口 */}
          <Link
            href="/guide"
            className="link-quiet text-xs"
          >
            ？ 使い方を見る
          </Link>
        </div>
        <Link
          href="/projects/new"
          className="btn-primary"
        >
          ＋ 新しいプロジェクト
        </Link>
      </div>

      {missingKey && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-ink bg-marker p-4 text-sm">
          <p className="text-ink">
            Claude API
            キーがまだ設定されていません。判定や先生モードを使うには、設定画面の「接続」で入れてください。
          </p>
          <Link
            href="/settings"
            className="btn"
          >
            接続を設定する
          </Link>
        </div>
      )}

      {demoMode && (
        <div className="flex flex-wrap items-center gap-3 border-l-2 border-ink bg-marker p-4 text-sm">
          <button
            type="button"
            onClick={handleCreateDemo}
            className="btn"
          >
            デモ用のプロジェクトを作る
          </button>
        </div>
      )}

      {projects === null ? (
        <p className="text-sm text-ink-3">読み込み中...</p>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-ink-3 p-8 text-center">
          <p className="font-serif font-medium text-ink">
            最初のプロジェクトを作りましょう
          </p>
          <Link
            href="/projects/new"
            className="btn mt-4"
          >
            新しいプロジェクトを作る
          </Link>
        </div>
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  );
}
