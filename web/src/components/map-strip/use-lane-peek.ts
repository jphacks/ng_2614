"use client";

import { useEffect, useState, type RefObject } from "react";

// 畳んだ帯で、クリックしたレーン1つの中身を重ねて出すための状態。マウスを合わせただけでは開かない。
// もう一度クリック・Esc・root の外のクリックで閉じる

type Entry = { id: string; pos: number };

export type LanePeek = {
  shown: string | null; // いま中身を出しているレーンの id
  pos: number; // 中身を重ねる位置（px。横の帯は左端、縦の帯は上端）
  toggle: (phaseId: string, pos: number) => void;
};

export function useLanePeek(root: RefObject<HTMLElement | null>): LanePeek {
  const [shown, setShown] = useState<Entry | null>(null);

  useEffect(() => {
    if (!shown) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShown(null);
    }
    function onDown(e: MouseEvent) {
      const el = root.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setShown(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [shown, root]);

  return {
    shown: shown?.id ?? null,
    pos: shown?.pos ?? 0,
    toggle: (id, pos) => setShown((prev) => (prev?.id === id ? null : { id, pos })),
  };
}
