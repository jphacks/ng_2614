// リクエストごとの AI の設定と使用量の集計（F-17）。サーバー側だけで使う。
// ルート（withLlm）が置き、AI を呼ぶ共通の関数（structured.ts）が読み書きする。
// こうすると、判定・先生モード・作業フローマップの関数の引数を変えずに済む

import { AsyncLocalStorage } from "node:async_hooks";
import type { LlmEffort, LlmModel, LlmUsage } from "@/lib/api-types";
import { estimateCostUsd, type TokenCounts } from "./models";

export type LlmContext = {
  model?: LlmModel;
  effort?: LlmEffort;
  usage?: LlmUsage; // AI を呼ぶたびに足していく
};

const storage = new AsyncLocalStorage<LlmContext>();

export function runWithLlm<T>(context: LlmContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function llmChoice(): { model?: LlmModel; effort?: LlmEffort } {
  const ctx = storage.getStore();
  return { model: ctx?.model, effort: ctx?.effort };
}

// 文脈の外（テストなど）で呼ばれたら何もしない
export function recordLlmUsage(model: LlmModel, counts: TokenCounts): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  const cost = estimateCostUsd(model, counts);
  const prev = ctx.usage;
  ctx.usage = {
    model,
    calls: (prev?.calls ?? 0) + 1,
    inputTokens: (prev?.inputTokens ?? 0) + counts.inputTokens,
    outputTokens: (prev?.outputTokens ?? 0) + counts.outputTokens,
    cacheReadTokens: (prev?.cacheReadTokens ?? 0) + counts.cacheReadTokens,
    cacheWriteTokens: (prev?.cacheWriteTokens ?? 0) + counts.cacheWriteTokens,
    costUsd: (prev?.costUsd ?? 0) + cost,
  };
}
