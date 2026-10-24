"use client";

// ヘッダーの左上に置く、ページを移るメニュー（F-16）。押すと左から一覧が開く。
// プロジェクトは localStorage から読むので、開くたびに読み直す

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { themeIdFromPath } from "@/lib/map/summary";
import { getReview, getTheme, listThemes } from "@/lib/storage";
import type { ResearchTheme } from "@/lib/types";

// 開閉のアニメーションの時間（Tailwind の duration-200 と合わせる）
const SLIDE_MS = 200;

type MenuData = {
  current: ResearchTheme | undefined; // 開いているプロジェクト
  others: ResearchTheme[];
};

function loadMenu(pathname: string): MenuData {
  const id = themeIdFromPath(pathname, (reviewId) => getReview(reviewId)?.themeId);
  const current = id ? getTheme(id) : undefined;
  return {
    current,
    others: listThemes().filter((t) => t.id !== current?.id),
  };
}

function projectPages(themeId: string) {
  const base = `/themes/${encodeURIComponent(themeId)}`;
  return [
    { href: base, label: "詳細・問題ログ" },
    { href: `${base}/reviews/new`, label: "変更を取り込む" },
    { href: `${base}/teacher`, label: "先生モード" },
    { href: `${base}/map`, label: "作業フローマップ" },
  ];
}

export function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MenuData>({ current: undefined, others: [] });

  // 開くたびにプロジェクトを読み直す
  useEffect(() => {
    if (open) setData(loadMenu(pathname));
  }, [open, pathname]);

  // ページを移ったら閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 開閉のアニメーション。rendered は DOM に置くか、shown は画面に出ている位置にあるか。
  // 開くときは置いてから次の描画で動かし、閉じるときは動き終わってから外す
  const [rendered, setRendered] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setRendered(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setRendered(false), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        aria-expanded={open}
        aria-controls="nav-menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {rendered && (
        <div className={`fixed inset-0 z-50 ${shown ? "" : "pointer-events-none"}`}>
          {/* メニューの外を押すと閉じる */}
          <div
            className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              shown ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="nav-menu"
            aria-label="ページ"
            className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
              shown ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="font-bold">メニュー</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="メニューを閉じる"
                className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <MenuSection>
              <MenuLink href="/" pathname={pathname}>
                プロジェクト一覧
              </MenuLink>
              <MenuLink href="/projects/new" pathname={pathname}>
                ＋ 新しいプロジェクト
              </MenuLink>
            </MenuSection>

            {data.current && (
              <MenuSection title={data.current.name}>
                {projectPages(data.current.id).map((p) => (
                  <MenuLink key={p.href} href={p.href} pathname={pathname}>
                    {p.label}
                  </MenuLink>
                ))}
              </MenuSection>
            )}

            {data.others.length > 0 && (
              <MenuSection title={data.current ? "ほかのプロジェクト" : "プロジェクト"}>
                {data.others.map((t) => (
                  <MenuLink
                    key={t.id}
                    href={`/themes/${encodeURIComponent(t.id)}`}
                    pathname={pathname}
                  >
                    {t.name}
                  </MenuLink>
                ))}
              </MenuSection>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function MenuSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 px-2 py-3">
      {title && (
        <p className="truncate px-2 pb-1 text-xs font-bold text-gray-500" title={title}>
          {title}
        </p>
      )}
      <ul>{children}</ul>
    </div>
  );
}

function MenuLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const active = decodeURIComponent(pathname) === decodeURIComponent(href);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`block truncate rounded-md px-2 py-2 text-sm ${
          active
            ? "bg-blue-50 font-medium text-blue-800"
            : "text-gray-800 hover:bg-gray-100"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}
