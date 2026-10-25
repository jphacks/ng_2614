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

