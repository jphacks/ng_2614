"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useMediaQuery,
  useStripOpen,
  useStripOrientation,
} from "@/lib/map/prefs";
import { isMapPage, themeIdFromPath } from "@/lib/map/summary";
import {
  getReview,
  getWorkflowMap,
  MAPS_CHANGED_EVENT,
  REVIEWS_CHANGED_EVENT,
} from "@/lib/storage";
import type { WorkflowMap } from "@/lib/types";
import { SIDE_WIDTH, SIDE_WIDTH_VAR, WIDE_QUERY } from "./sizes";
import { StripBody } from "./StripBody";
import { StripSide } from "./StripSide";

// プロジェクトに関する画面に常に出す、作業フローマップの帯（F-15）。
// 横（ヘッダーの下）か縦（右のサイドバー）。縦のときは、本文の右側を空ける幅を CSS 変数で layout に伝える。
// マップは localStorage から読むので、マウントしてから読む

type Loaded = { themeId: string; map: WorkflowMap | undefined };

export function MapStrip() {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const orientation = useStripOrientation();
  const wide = useMediaQuery(WIDE_QUERY);
  const open = useStripOpen();

  useEffect(() => {
    function load() {
      if (isMapPage(pathname)) {
        setLoaded(null);
        return;
      }
      const themeId = themeIdFromPath(pathname, (id) => getReview(id)?.themeId);
      setLoaded(themeId ? { themeId, map: getWorkflowMap(themeId) } : null);
    }
    load();
    window.addEventListener(MAPS_CHANGED_EVENT, load);
    window.addEventListener(REVIEWS_CHANGED_EVENT, load);
    window.addEventListener("storage", load); // 別タブでの変更
    return () => {
      window.removeEventListener(MAPS_CHANGED_EVENT, load);
      window.removeEventListener(REVIEWS_CHANGED_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [pathname]);

  // マップが無いときと狭い画面では、縦を選んでいても横で出す
  const vertical = !!loaded?.map && orientation === "vertical" && wide;

  useEffect(() => {
    const root = document.documentElement;
    if (vertical) {
      const width = open ? SIDE_WIDTH.open : SIDE_WIDTH.collapsed;
      root.style.setProperty(SIDE_WIDTH_VAR, `${width}px`);
    } else {
      root.style.removeProperty(SIDE_WIDTH_VAR);
    }
    return () => {
      root.style.removeProperty(SIDE_WIDTH_VAR);
    };
  }, [vertical, open]);

  if (!loaded) return null;
  if (vertical && loaded.map) {
    return <StripSide themeId={loaded.themeId} map={loaded.map} />;
  }

  return (
    <nav
      aria-label="作業フローマップ"
      className="sticky top-0 z-30 border-b border-gray-200 bg-white"
    >
      {loaded.map ? (
        <StripBody themeId={loaded.themeId} map={loaded.map} />
      ) : (
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 px-4 py-1 text-xs text-gray-600">
          <span>このプロジェクトの作業フローマップはまだありません</span>
          <Link
            href={`/themes/${encodeURIComponent(loaded.themeId)}/map`}
            className="font-medium text-blue-700 hover:underline"
          >
            作る
          </Link>
        </div>
      )}
    </nav>
  );
}
