// デモモード（F-12）の切り替え。状態はブラウザの localStorage に置く。
// 画面（クライアントコンポーネント）からだけ呼ぶ。

import { useSyncExternalStore } from "react";

const KEY = "rc.demoMode";
const EVENT = "rc:demo-mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // 保存できなくても、この画面の中では切り替わったことにする
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

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, isDemoMode, () => false);
}
