import { useEffect, useRef } from "react";

// スレッドの末尾に置いた目印の要素を返す。deps のどれかが変わったら、その要素が見える位置まで自動でスクロールする。
// 初回表示（マウント時）はスクロールしない。OS で動きを減らす設定のときはアニメーションなしで動かす
export function useScrollToEnd<T extends HTMLElement>(
  deps: readonly unknown[],
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const prevDeps = useRef<readonly unknown[] | null>(null);

  // deps の長さや中身が変わったかを、Object.is で1つずつ比べる（deps の配列自体は毎回作り直されるため）
  const prev = prevDeps.current;
  const changed =
    prev !== null &&
    (prev.length !== deps.length || deps.some((d, i) => !Object.is(d, prev[i])));

  // 変わったときだけ増える数。これを effect の依存にして、変化のたびに1回だけスクロールする
  const version = useRef(0);
  if (changed) version.current += 1;
  prevDeps.current = deps;
  const currentVersion = version.current;

  useEffect(() => {
    // 初回表示では動かさない（version が 0 のまま）
    if (currentVersion === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      block: "end",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [currentVersion]);

  return ref;
}
