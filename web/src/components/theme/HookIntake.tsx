"use client";

// S-4 の上部に置く、変更の届き方の案内。取り込みの主な方法はフック（F-13）なので、ここを主役にする。
// デモモードではフックを使わないので、コミットから取り込むよう案内する

import Link from "next/link";
import { useDemoMode } from "@/lib/demo/mode";

export function HookIntake({ themeId }: { themeId: string }) {
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
        研究のリポジトリにフックを入れておくと、届いたときに画面の右下に知らせが出ます。
        <Link href="/guide#hook" className="ml-1 text-blue-700 hover:underline">
          フックの入れ方
        </Link>
      </p>
    </section>
  );
}
