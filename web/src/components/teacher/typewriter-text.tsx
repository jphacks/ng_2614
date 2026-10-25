"use client";

// 先生の発言を、タイプライターのように少しずつ表示する。
// 画面読み上げには全文を1回だけ渡し、アニメーション中の文字は読み上げさせない。
// 動きを減らす設定（prefers-reduced-motion）のときや animate が false のときは、すぐに全文を出す
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// 長い文章でも、全体でこの時間（ms）を超えないように1回に出す文字数を増やす
const MAX_TOTAL_MS = 2500;

// 動きを減らす設定かどうか。サーバー側では false として描画し、ハイドレーションのずれを避ける
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduce(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
}

export function TypewriterText({
  text,
  animate,
  msPerChar = 25,
  onDone,
}: {
  text: string;
  animate: boolean;
  msPerChar?: number;
  onDone?: () => void;
}) {
  const chars = Array.from(text);
  const total = chars.length;
  // 表示済みの文字数。「どの text に対する値か」も持ち、text が変わったら 0 から数え直す
  const [shown, setShown] = useState<{ text: string; count: number }>({
    text,
    count: 0,
  });
  const count = shown.text === text ? shown.count : 0;

  // onDone は最新のものを使いたいが、変わるたびにアニメーションを再開したくない
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const reduce = useReducedMotion();
  const full = !animate || reduce;

  useEffect(() => {
    if (full || total === 0) {
      doneRef.current?.();
      return;
    }
    // 1回に出す文字数。全体が MAX_TOTAL_MS に収まるように決める
    const step = Math.max(1, Math.ceil((total * msPerChar) / MAX_TOTAL_MS));
    let n = 0;
    const timer = setInterval(() => {
      n = Math.min(total, n + step);
      setShown({ text, count: n });
      if (n >= total) {
        clearInterval(timer);
        doneRef.current?.();
      }
    }, msPerChar);
    return () => clearInterval(timer);
  }, [text, full, msPerChar, total]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {full ? (
          text
        ) : (
          <>
            {chars.slice(0, count).join("")}
            {/* 未表示の残りは見えないまま場所だけ取り、最終的な高さを最初から保つ */}
            <span className="invisible">{chars.slice(count).join("")}</span>
          </>
        )}
      </span>
    </>
  );
}
