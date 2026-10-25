import type { Metadata } from "next";
import { Klee_One, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import Link from "next/link";
import {
  DemoModeToggle,
} from "@/components/demo/DemoModeToggle";
import { HookInbox } from "@/components/hook/HookInbox";
import { MapStrip } from "@/components/map-strip/MapStrip";
import { NavMenu } from "@/components/nav/NavMenu";
import "./globals.css";

// 本文のゴシック体、見出しの明朝体、先生の言葉の手書き風の字（設計書「画面の見た目」）。
// globals.css の --font-sans / --font-serif / --font-hand から使う
const sans = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-jp",
});
const serif = Noto_Serif_JP({
  weight: ["500", "600"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-jp",
});
const hand = Klee_One({
  weight: ["600"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-klee-one",
});

export const metadata: Metadata = {
  title: "TAZUNA",
  description:
    "AIが黙って解決した問題を見逃さず、研究と実装の理解を取り戻す Web アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${sans.variable} ${serif.variable} ${hand.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        {/* 作業フローマップの帯が縦（右のサイドバー）のときは、その幅だけ右側を空ける（MapStrip が変数を付ける） */}
        <div className="md:pr-[var(--map-side-w,0px)]">
          <header className="border-b border-hair bg-sheet">
            {/* 上端の3色の帯（藍・空・若葉） */}
            <div aria-hidden="true" className="grid h-1 grid-cols-3">
              <span className="bg-accent" />
              <span className="bg-sky" />
              <span className="bg-mint" />
            </div>
            {/* メニューのボタンはアプリ名の左に並べる。枠の左右の余白は本文（main）と合わせる */}
            <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <NavMenu />
                <Link href="/" className="flex items-baseline gap-2">
                  <span className="font-serif text-lg font-semibold tracking-[0.2em]">TAZUNA</span>
                  {/* 名前の由来（手綱）を、先生の言葉と同じ手書き風の字で添える */}
                  <span className="font-hand text-sm text-ink-3">手綱</span>
                </Link>
              </div>
              <DemoModeToggle />
            </div>
          </header>
          <MapStrip />
          <HookInbox />
          {/* 全体の枠は最大 1536px。本文の幅は画面ごとに決める（components/layout/PageWidth.tsx） */}
          <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
