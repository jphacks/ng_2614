import type { Metadata } from "next";
import Link from "next/link";
import {
  DemoModeBanner,
  DemoModeToggle,
} from "@/components/demo/DemoModeToggle";
import { HookInbox } from "@/components/hook/HookInbox";
import { MapStrip } from "@/components/map-strip/MapStrip";
import { NavMenu } from "@/components/nav/NavMenu";
import "./globals.css";

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
    <html lang="ja">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {/* 作業フローマップの帯が縦（右のサイドバー）のときは、その幅だけ右側を空ける（MapStrip が変数を付ける） */}
        <div className="md:pr-[var(--map-side-w,0px)]">
          <header className="border-b border-gray-200">
            <DemoModeBanner />
            {/* メニューのボタンはアプリ名の左に並べる。枠の左右の余白は本文（main）と合わせる */}
            <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <NavMenu />
                <Link href="/" className="font-bold">
                  TAZUNA
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
