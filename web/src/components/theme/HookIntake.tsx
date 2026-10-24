"use client";

// S-4 の上部に置く、変更の届き方の案内。取り込みの主な方法はフック（F-13）なので、ここを主役にする。
// デモモードではフックを使わないので、コミットから取り込むよう案内する

import Link from "next/link";
import { useDemoMode } from "@/lib/demo/mode";

export function HookIntake({ themeId, repo }: { themeId: string; repo: string }) {
  const demo = useDemoMode();
  const importHref = `/themes/${encodeURIComponent(themeId)}/reviews/new`;

  if (demo) {
    return (
      <section
        aria-label="変更の届き方"
        className="rounded-md border border-amber-200 bg-amber-50 p-4"
      >
        <p className="font-semibold text-amber-900">
          デモモードでは、Claude Code のフックは使いません
        </p>
        <p className="mt-1 text-sm text-amber-900">
          コミットから取り込むで、デモのコミット（cosine スケジュールを追加して linear と比較）を選ぶと、判定まで試せます。
        </p>
        <Link
          href={importHref}
          className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          コミットから取り込む
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="変更の届き方"
      className="rounded-md border border-blue-200 bg-blue-50 p-4"
    >
      <p className="font-semibold text-blue-900">
        Claude Code に頼むと、作業が終わるたびに変更が自動で届きます
      </p>
      <p className="mt-1 text-sm text-blue-900">
        研究のリポジトリ（<code className="font-mono text-xs">{repo}</code>）に Claude Code
        のフックを入れておくと、依頼文・変更の差分・作業中のエラー・AI の報告が届きます。届くと画面の右下に知らせが出て、判定が始まります。コミットしなくてかまいません。
      </p>
      <p className="mt-2 text-sm">
        <Link href="/guide#hook" className="text-blue-700 hover:underline">
          フックの入れ方を見る
        </Link>
        <span className="mx-2 text-gray-400">·</span>
        <span className="text-gray-600">
          フックを使わないときは
          <Link href={importHref} className="mx-1 text-blue-700 hover:underline">
            コミットから取り込む
          </Link>
          こともできます
        </span>
      </p>
    </section>
  );
}
