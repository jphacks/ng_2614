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
        <h1 className="text-xl font-bold">プロジェクト</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ＋ 新しいプロジェクト
        </Link>
      </div>

      {missingKey && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="text-amber-900">
            Claude API
            キーがまだ設定されていません。判定や先生モードを使うには、設定画面の「接続」で入れてください。
          </p>
          <Link
            href="/settings"
            className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
          >
            接続を設定する
          </Link>
        </div>
      )}

      {demoMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="text-amber-900">
            デモ用のプロジェクトで、取り込み → 判定 → 先生モードを試せます。
          </p>
          <button
            type="button"
            onClick={handleCreateDemo}
            className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
          >
            デモ用のプロジェクトを作る
          </button>
        </div>
      )}

      {projects === null ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="font-medium text-gray-900">
            最初のプロジェクトを作りましょう
          </p>
          <p className="mt-1 text-sm text-gray-600">
            研究のリポジトリを選び、研究の目的（問い・手法・評価）を書くと、AI
            の変更をその目的と照らし合わせられます。
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-block rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
