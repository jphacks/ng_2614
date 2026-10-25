// AI の使用量の記録（F-17）。API が X-LLM-Usage で返した分を、日付・機能・モデルごとに足して localStorage に置く。
// 画面（クライアントコンポーネント）からだけ呼ぶ。

import { useSyncExternalStore } from "react";
import type { LlmModel, LlmUsage } from "./api-types";
import type { LlmFeature } from "./llm-settings";
import { isLlmModel } from "./llm/models";

export type UsageTotals = Omit<LlmUsage, "model">;
// 日付（YYYY-MM-DD、このパソコンの時刻）→「機能|モデル」→ 合計
export type UsageStore = Record<string, Record<string, UsageTotals>>;

export const KEEP_DAYS = 31;

const KEY = "rc.llmUsage";
const EVENT = "rc:llm-usage";

const EMPTY: UsageTotals = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
};

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function add(a: UsageTotals, b: UsageTotals): UsageTotals {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

// 新しい記録を足し、古い日付を落とした新しい store を返す
export function addUsage(
  store: UsageStore,
  day: string,
  feature: LlmFeature,
  usage: LlmUsage,
): UsageStore {
  const { model, ...totals } = usage;
  const key = `${feature}|${model}`;
  const dayRows = { ...(store[day] ?? {}) };
  dayRows[key] = add(dayRows[key] ?? EMPTY, totals);
  const next = { ...store, [day]: dayRows };
  const days = Object.keys(next).sort().reverse().slice(0, KEEP_DAYS);
  return Object.fromEntries(days.map((d) => [d, next[d]]));
}

export type UsageRow = { feature: LlmFeature; model: LlmModel } & UsageTotals;

// day を渡せばその日だけ、無ければ全部の日を、機能・モデルごとにまとめる
export function summarizeUsage(
  store: UsageStore,
  day?: string,
): { rows: UsageRow[]; total: UsageTotals } {
  const merged = new Map<string, UsageTotals>();
  for (const [d, rows] of Object.entries(store)) {
    if (day && d !== day) continue;
    for (const [key, totals] of Object.entries(rows)) {
      merged.set(key, add(merged.get(key) ?? EMPTY, totals));
    }
  }
  const rows: UsageRow[] = [];
  for (const [key, totals] of merged) {
    const [feature, model] = key.split("|");
    if (!isLlmModel(model)) continue;
    rows.push({ feature: feature as LlmFeature, model, ...totals });
  }
  rows.sort((a, b) => b.costUsd - a.costUsd);
  const total = rows.reduce<UsageTotals>((acc, r) => add(acc, r), EMPTY);
  return { rows, total };
}

// X-LLM-Usage の中身を確かめる。形が違えば undefined
export function parseUsageHeader(raw: string | null): LlmUsage | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<LlmUsage>;
    const nums = [
      v.calls,
      v.inputTokens,
      v.outputTokens,
      v.cacheReadTokens,
      v.cacheWriteTokens,
      v.costUsd,
    ];
    if (
      !isLlmModel(v.model) ||
      !nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
    ) {
      return undefined;
    }
    return v as LlmUsage;
  } catch {
    return undefined;
  }
}

let cache: { raw: string | null; value: UsageStore } | undefined;

export function getUsageStore(): UsageStore {
  if (typeof window === "undefined") return {};
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // 読めなければ空のまま
  }
  if (cache?.raw === raw) return cache.value;
  let value: UsageStore = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null)
      value = parsed as UsageStore;
  } catch {
    value = {};
  }
  cache = { raw, value };
  return value;
}

export function recordUsage(
  feature: LlmFeature,
  usage: LlmUsage,
  now = new Date(),
): void {
  if (typeof window === "undefined") return;
  const next = addUsage(getUsageStore(), dayKey(now), feature, usage);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、判定などは止めない
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetUsage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 消せなくても画面は止めない
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const EMPTY_STORE: UsageStore = {};

export function useUsageStore(): UsageStore {
  return useSyncExternalStore(subscribe, getUsageStore, () => EMPTY_STORE);
}
