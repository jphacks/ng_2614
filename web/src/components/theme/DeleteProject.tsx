"use client";

// S-4 のいちばん下に置く「プロジェクトを削除」（F-1）。
// 元に戻せないので、消えるものの件数を並べて確かめてから消す

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDiff } from "@/lib/diff-store";
import {
  deleteTheme,
  getWorkflowMap,
  listTeacherSessions,
} from "@/lib/storage";
import type { ResearchTheme } from "@/lib/types";

export function DeleteProject({
  theme,
  reviewCount,
  problemCount,
}: {
  theme: ResearchTheme;
  reviewCount: number;
  problemCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const teacherCount = listTeacherSessions(theme.id).length;
  const hasMap = getWorkflowMap(theme.id) !== undefined;

  const handleDelete = async () => {
    setDeleting(true);
    const removed = deleteTheme(theme.id);
    // 差分は IndexedDB にある。消せなくても、プロジェクトの削除は止めない
    await Promise.all(removed.map((id) => deleteDiff(id).catch(() => {})));
    router.push("/");
  };

  return (
    <section className="border-t border-hair pt-6">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-pen underline decoration-pen/40 underline-offset-4 hover:decoration-pen"
        >
          プロジェクトを削除
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-labelledby="delete-project-title"
          className="border border-pen border-l-4 p-4"
        >
          <p id="delete-project-title" className="font-medium text-pen">
            「{theme.name}」を削除しますか？
          </p>
          <p className="mt-1 text-sm text-ink">
            次のものもまとめて消えます。元に戻せません。
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink">
            <li>取り込んだ変更（判定とコードの差分）：{reviewCount} 件</li>
            <li>問題ログに保存した問題：{problemCount} 件</li>
            <li>先生モードの記録：{teacherCount} 件</li>
            <li>作業フローマップ：{hasMap ? "あり" : "なし"}</li>
          </ul>
          <p className="mt-2 text-xs text-ink-2">
            GitHub のリポジトリと、研究のリポジトリのファイルは消えません。
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-pen disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "削除しています…" : "削除する"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="btn"
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
