"use client";

// 開いた縦の帯（StripSide）の左端に置く、幅を変えるつまみ（F-15）。
// マウスでドラッグ、キーボードでは左右の矢印キー、ダブルクリックで初期の幅に戻す。
// 帯は overflow-y-auto で中身がスクロールするので、つまみは帯の外に fixed で置く

import { useRef, useState } from "react";
import { SIDE_OPEN_WIDTH, setSideWidth } from "@/lib/map/prefs";

// 矢印キー1回で変える幅（px）
const KEY_STEP = 16;

export function SideResizeHandle({ width }: { width: number }) {
  const [dragging, setDragging] = useState(false);
  // ドラッグを始めたときのマウスの位置と幅
  const start = useRef<{ x: number; width: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    // 帯は右端にあるので、左へ動かすほど広くなる
    setSideWidth(start.current.width + (start.current.x - e.clientX));
  }

  function onPointerEnd() {
    start.current = null;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") setSideWidth(width + KEY_STEP);
    else if (e.key === "ArrowRight") setSideWidth(width - KEY_STEP);
    else if (e.key === "Home") setSideWidth(SIDE_OPEN_WIDTH.initial);
    else return;
    e.preventDefault();
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="作業フローマップの幅"
        aria-valuenow={width}
        aria-valuemin={SIDE_OPEN_WIDTH.min}
        aria-valuemax={SIDE_OPEN_WIDTH.max}
        tabIndex={0}
        title="ドラッグで幅を変える（ダブルクリックで元の幅に戻す）"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={() => setSideWidth(SIDE_OPEN_WIDTH.initial)}
        onKeyDown={onKeyDown}
        style={{ right: width - 4 }}
        className="group fixed inset-y-0 z-40 flex w-2 cursor-col-resize touch-none justify-center outline-none"
      >
        <span
          aria-hidden="true"
          className={`h-full w-0.5 transition-colors ${
            dragging
              ? "bg-indigo-500"
              : "bg-transparent group-hover:bg-indigo-300 group-focus-visible:bg-indigo-500"
          }`}
        />
      </div>
      {/* ドラッグ中は、本文の文字が選ばれたりカーソルが変わったりしないよう、画面全体を覆う */}
      {dragging && <div aria-hidden="true" className="fixed inset-0 z-30 cursor-col-resize select-none" />}
    </>
  );
}
