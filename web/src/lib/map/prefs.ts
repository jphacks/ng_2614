// 作業フローマップ（F-15）の表示の好み（見る人ごと。ブラウザの localStorage に置く）。
// 画面（クライアントコンポーネント）からだけ呼ぶ。保存できなくても画面は動くようにする。
// 【担当：サブエージェント A。シグネチャは帯の担当（B）とマップ画面の担当（C）が使うので変えない】
// 書き方は web/src/lib/demo/mode.ts（useSyncExternalStore とイベント）に合わせる。

import { useCallback, useSyncExternalStore } from "react";

const KEY = "rc.mapStripOpen";
const EVENT = "rc:map-strip-open";

// localStorage に書けなかったときだけ使う、この画面の中の値（demo/mode.ts と違い、開閉が効かなくなるのを避ける）
let fallback: boolean | undefined;

// 画面上部の帯を開いているか。キーは "rc.mapStripOpen"、初期値は false（畳んでいる）
export function getStripOpen(): boolean {
  if (typeof window === "undefined") return false;
  if (fallback !== undefined) return fallback;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setStripOpen(open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (open) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
    fallback = undefined;
  } catch {
    // 保存できなくても、この画面の中では切り替わったことにする
    fallback = open;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // 別のタブで切り替えたとき
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// 帯を開いているかを、ほかの画面・タブでの切り替えにも追従して返す。サーバー側では false
export function useStripOpen(): boolean {
  return useSyncExternalStore(subscribe, getStripOpen, () => false);
}

// ---- 帯の向き ----
// 【担当：サブエージェント A。シグネチャは帯の担当（B・C）と親が使うので変えない】

export type StripOrientation = "horizontal" | "vertical";

const ORIENTATION_KEY = "rc.mapStripOrientation";
const ORIENTATION_EVENT = "rc:map-strip-orientation";

// localStorage に書けなかったときだけ使う、この画面の中の値（getStripOpen の fallback と同じ）
let orientationFallback: StripOrientation | undefined;

// 帯の向き。キーは "rc.mapStripOrientation"、初期値は "horizontal"（上の横の帯）。
// "vertical" は左のサイドバー。保存できないときの扱いは getStripOpen と同じ
export function getStripOrientation(): StripOrientation {
  if (typeof window === "undefined") return "horizontal";
  if (orientationFallback !== undefined) return orientationFallback;
  try {
    // 想定外の値が入っていたら "horizontal"
    return window.localStorage.getItem(ORIENTATION_KEY) === "vertical" ? "vertical" : "horizontal";
  } catch {
    return "horizontal";
  }
}

export function setStripOrientation(orientation: StripOrientation): void {
  if (typeof window === "undefined") return;
  try {
    if (orientation === "vertical") window.localStorage.setItem(ORIENTATION_KEY, "vertical");
    else window.localStorage.removeItem(ORIENTATION_KEY);
    orientationFallback = undefined;
  } catch {
    // 保存できなくても、この画面の中では切り替わったことにする
    orientationFallback = orientation;
  }
  window.dispatchEvent(new Event(ORIENTATION_EVENT));
}

function subscribeOrientation(onChange: () => void): () => void {
  window.addEventListener(ORIENTATION_EVENT, onChange);
  window.addEventListener("storage", onChange); // 別のタブで切り替えたとき
  return () => {
    window.removeEventListener(ORIENTATION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// 帯の向きを、ほかの画面・タブでの切り替えにも追従して返す。サーバー側では "horizontal"
export function useStripOrientation(): StripOrientation {
  return useSyncExternalStore(subscribeOrientation, getStripOrientation, () => "horizontal");
}

// 画面の幅がメディアクエリ（例：web/src/components/map-strip/sizes.ts の WIDE_QUERY）に合うか。
// window.matchMedia の change に追従する。サーバー側と matchMedia が無いときは false
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  }, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
