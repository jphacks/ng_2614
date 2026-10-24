import type { Metadata } from "next";
import Link from "next/link";
import {
  DemoModeBanner,
  DemoModeToggle,
} from "@/components/demo/DemoModeToggle";
import { HookInbox } from "@/components/hook/HookInbox";
import { MapStrip } from "@/components/map-strip/MapStrip";
import "./globals.css";

export const metadata: Metadata = {
  title: "研究の理解ログ（仮）",
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
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-bold">
                研究の理解ログ（仮）
              </Link>
              <DemoModeToggle />
            </div>
          </header>
          <MapStrip />
          <HookInbox />
          <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
