"use client";

// ヘッダーに置くデモモード（F-12）の切り替え

import { setDemoMode, useDemoMode } from "@/lib/demo/mode";

export function DemoModeToggle() {
  const on = useDemoMode();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setDemoMode(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      <span className={on ? "marker font-bold" : "text-ink-2"}>
        デモモード
      </span>
    </label>
  );
}

// デモモード中だけ、画面の上に常に出す帯
export function DemoModeBanner() {
  const on = useDemoMode();
  if (!on) return null;
  return (
    <div className="border-b border-ink bg-marker px-4 py-1.5 text-center text-xs text-ink">
      デモモード：GitHub と AI（Claude）は呼ばず、用意したデモデータで動いています
    </div>
  );
}
