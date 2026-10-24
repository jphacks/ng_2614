"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RepoPicker } from "@/components/project/RepoPicker";
import {
  EMPTY_THEME_VALUES,
  REPO_PATTERN,
  ThemeForm,
  type ThemeFormValues,
} from "@/components/theme/ThemeForm";
import { listThemes, newId, saveTheme } from "@/lib/storage";

// S-6 新しいプロジェクト：① リポジトリを選ぶ → ② 研究の目的を書く
export default function NewProjectPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">読み込み中...</p>}>
      <NewProject />
    </Suspense>
  );
}

function NewProject() {
  const router = useRouter();
  const requested = useSearchParams().get("repo")?.trim() ?? "";
  const [registered, setRegistered] = useState<Map<string, string> | null>(
    null,
  );
  const [repo, setRepo] = useState<string | null>(null);

  useEffect(() => {
    const map = new Map(
      listThemes().map((t) => [t.repo.trim().toLowerCase(), t.id] as const),
    );
    setRegistered(map);
    // フックの知らせから来たときは、そのリポジトリを選んだ状態から始める
    if (REPO_PATTERN.test(requested) && !map.has(requested.toLowerCase())) {
      setRepo(requested);
    }
  }, [requested]);

  const handleSubmit = (values: ThemeFormValues) => {
    const id = newId();
    saveTheme({ id, ...values, updatedAt: "" }); // updatedAt は保存時に付く
    router.push(`/themes/${id}`);
  };

  if (!registered) {
    return <p className="text-sm text-gray-500">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← プロジェクト一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">新しいプロジェクト</h1>
        <p className="mt-1 text-xs text-gray-500">
          ステップ {repo ? 2 : 1} / 2
        </p>
      </div>

      {repo === null ? (
        <section>
          <h2 className="text-lg font-bold">GitHub のリポジトリを選ぶ</h2>
          <p className="mt-1 text-sm text-gray-600">
            この研究のコードが入っているリポジトリです。Claude Code
            のフックで届いた変更は、このリポジトリのプロジェクトに結びつきます。
          </p>
          <div className="mt-4">
            <RepoPicker registered={registered} onSelect={setRepo} />
          </div>
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-bold">研究の目的を書く</h2>
          <p className="mt-1 text-sm text-gray-600">
            研究の目的（問い・手法・評価）を書いておくと、AI
            の変更が研究にどう影響するかを照らし合わせられます。
          </p>
          <div className="mt-4">
            <ThemeForm
              key={repo}
              initial={{
                ...EMPTY_THEME_VALUES,
                repo,
                name: repo.split("/")[1] ?? "",
              }}
              repoLocked
              submitLabel="登録する"
              onSubmit={handleSubmit}
              onCancel={() => setRepo(null)}
              cancelLabel="リポジトリを選び直す"
            />
          </div>
        </section>
      )}
    </div>
  );
}
