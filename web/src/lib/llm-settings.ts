// AI の設定（F-17）：機能ごとのモデルとエフォート。ブラウザの localStorage に置く。
// 画面（クライアントコンポーネント）からだけ呼ぶ。

import { useSyncExternalStore } from "react";
import type { LlmEffort, LlmModel } from "./api-types";
import {
  DEFAULT_MODEL,
  isLlmEffort,
  isLlmModel,
  LLM_HEADERS,
} from "./llm/models";

export type LlmFeature = "review" | "teacher" | "map";

export const LLM_FEATURES: readonly {
  id: LlmFeature;
  label: string;
  description: string;
}[] = [
  {
    id: "review",
    label: "判定",
    description: "変更を「目的どおり／隠れた問題／余計な追加」に分ける",
  },
  {
    id: "teacher",
    label: "先生モード",
    description: "質問を作り、答えに問い返して採点する",
  },
  {
    id: "map",
    label: "作業フローマップ",
    description: "マップの目的を補い、研究への影響を選ぶ",
  },
];

// "default" は、機能ごとにコードで決めたエフォートを使う（判定と先生は medium など）
export type FeatureSetting = { model: LlmModel; effort: LlmEffort | "default" };
export type LlmSettings = Record<LlmFeature, FeatureSetting>;

const DEFAULT_SETTING: FeatureSetting = {
  model: DEFAULT_MODEL,
  effort: "default",
};

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  review: DEFAULT_SETTING,
  teacher: DEFAULT_SETTING,
  map: DEFAULT_SETTING,
};

const KEY = "rc.llmSettings";
const EVENT = "rc:llm-settings";

// 壊れた値や古い値が入っていても、使えるものだけ拾い、残りは標準に戻す
export function normalizeSettings(raw: unknown): LlmSettings {
  const obj =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const out = { ...DEFAULT_LLM_SETTINGS };
  for (const { id } of LLM_FEATURES) {
    const v = obj[id] as Partial<FeatureSetting> | undefined;
    out[id] = {
      model: isLlmModel(v?.model) ? v.model : DEFAULT_MODEL,
      effort:
        v?.effort === "default" || isLlmEffort(v?.effort)
          ? v.effort
          : "default",
    };
  }
  return out;
}

let cache: { raw: string | null; value: LlmSettings } | undefined;

export function getLlmSettings(): LlmSettings {
  if (typeof window === "undefined") return DEFAULT_LLM_SETTINGS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // 読めなければ標準のまま
  }
  // useSyncExternalStore が同じ値には同じオブジェクトを返すことを求めるので、覚えておく
  if (cache?.raw === raw) return cache.value;
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  cache = { raw, value: normalizeSettings(parsed) };
  return cache.value;
}

export function setLlmSetting(
  feature: LlmFeature,
  setting: FeatureSetting,
): void {
  if (typeof window === "undefined") return;
  const next = { ...getLlmSettings(), [feature]: setting };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても画面は止めない
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetLlmSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 消せなくても画面は止めない
  }
  window.dispatchEvent(new Event(EVENT));
}

// AI を呼ぶ API に付けるヘッダー
export function llmHeaders(feature: LlmFeature): Record<string, string> {
  const s = getLlmSettings()[feature];
  const headers: Record<string, string> = { [LLM_HEADERS.model]: s.model };
  if (s.effort !== "default") headers[LLM_HEADERS.effort] = s.effort;
  return headers;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // 別のタブで変えたとき
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLlmSettings(): LlmSettings {
  return useSyncExternalStore(
    subscribe,
    getLlmSettings,
    () => DEFAULT_LLM_SETTINGS,
  );
}
