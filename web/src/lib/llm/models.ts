// 選べる Claude のモデルとエフォート、料金の単価表（F-17）。
// 画面からもサーバーからも使うので、SDK など サーバー専用のものを import しない。

import type { LlmEffort, LlmModel, LlmUsage } from "@/lib/api-types";

export const DEFAULT_MODEL: LlmModel = "claude-haiku-5-5";

export const LLM_HEADERS = {
  model: "x-llm-model",
  effort: "x-llm-effort",
  usage: "x-llm-usage",
} as const;

// 100 万トークンあたりの米ドル。キャッシュの書き込みは 5 分のもの
type Price = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

type ModelInfo = {
  id: LlmModel;
  label: string;
  note: string;
  price: Price;
  longPrice?: Price; // 入力が LONG_PROMPT_TOKENS を超える呼び出しの単価（Haiku 5.5 だけ）
};

// 2026-10-24 に Anthropic の料金ページ（platform.claude.com/docs/en/about-claude/pricing）で確かめた値。
// 単価が変わったらここを直す
export const LLM_MODELS: readonly ModelInfo[] = [
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    note: "速くて安い（標準）",
    price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    longPrice: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 },
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "質と費用のバランス（Haiku の約 20 倍）",
    price: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    note: "いちばん賢い（Haiku の約 40 倍）",
    price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  },
];

export const LLM_EFFORTS: readonly LlmEffort[] = ["low", "medium", "high"];

export const LONG_PROMPT_TOKENS = 100_000;

export function isLlmModel(value: unknown): value is LlmModel {
  return LLM_MODELS.some((m) => m.id === value);
}

export function isLlmEffort(value: unknown): value is LlmEffort {
  return LLM_EFFORTS.includes(value as LlmEffort);
}

export function modelLabel(model: LlmModel): string {
  return LLM_MODELS.find((m) => m.id === model)?.label ?? model;
}

export type TokenCounts = Pick<
  LlmUsage,
  "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens"
>;

// 1 回の呼び出しの料金の目安。Haiku 5.5 は、入力（キャッシュの読み書きを含む）が 100,000 トークンを超えると全部が高い単価になる
export function estimateCostUsd(model: LlmModel, t: TokenCounts): number {
  const info = LLM_MODELS.find((m) => m.id === model);
  if (!info) return 0;
  const prompt = t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens;
  const p =
    info.longPrice && prompt > LONG_PROMPT_TOKENS ? info.longPrice : info.price;
  return (
    (t.inputTokens * p.input +
      t.outputTokens * p.output +
      t.cacheReadTokens * p.cacheRead +
      t.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}

// X-LLM-Model / X-LLM-Effort を読む。無ければ undefined、決めた値以外ならエラーの文言を返す
export function parseLlmHeaders(
  headers: Headers,
):
  | { ok: true; model?: LlmModel; effort?: LlmEffort }
  | { ok: false; error: string } {
  const model = headers.get(LLM_HEADERS.model)?.trim() || undefined;
  const effort = headers.get(LLM_HEADERS.effort)?.trim() || undefined;
  if (model !== undefined && !isLlmModel(model)) {
    return {
      ok: false,
      error: "X-LLM-Model に使えないモデルが指定されています",
    };
  }
  if (effort !== undefined && !isLlmEffort(effort)) {
    return {
      ok: false,
      error: "X-LLM-Effort は low / medium / high のどれかにしてください",
    };
  }
  return { ok: true, model, effort };
}
