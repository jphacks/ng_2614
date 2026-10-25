"use client";

// S-4 の上部に置く、変更の届き方の案内。取り込みの主な方法はフック（F-13）なので、ここを主役にする。
// デモモードでも同じ案内を出す（ピッチ用の入口で、フックの知らせが届くところを見せるため）

import Link from "next/link";

export function HookIntake() {
  return (
    <section
      aria-label="変更の届き方"
      className="border-l-2 border-ink py-1 pl-4"
    >
      <p className="font-semibold text-ink">
        Claude Code に頼むと、作業が終わるたびに変更が自動で届きます
      </p>
      <p className="mt-1 text-sm text-ink-2">
        研究のリポジトリにフックを入れておくと、届いたときに画面の右下に知らせが出ます。
        <Link href="/guide#hook" className="link ml-1">
          フックの入れ方
        </Link>
      </p>
    </section>
  );
}
