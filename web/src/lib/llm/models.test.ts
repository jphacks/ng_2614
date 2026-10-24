import { describe, expect, it } from "vitest";
import {
  estimateCostUsd,
  isLlmEffort,
  isLlmModel,
  parseLlmHeaders,
} from "./models";

const zero = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

describe("estimateCostUsd", () => {
  it("100 万トークンあたりの単価で計算する", () => {
    expect(
      estimateCostUsd("claude-sonnet-5-5", {
        ...zero,
        inputTokens: 1_000_000,
        outputTokens: 100_000,
      }),
    ).toBeCloseTo(2 + 1);
  });

  it("Haiku 5.5 は入力が 100,000 トークンまでなら安い単価", () => {
    expect(
      estimateCostUsd("claude-haiku-5-5", {
        ...zero,
        inputTokens: 100_000,
        outputTokens: 10_000,
      }),
    ).toBeCloseTo(0.01 + 0.005);
  });

  it("Haiku 5.5 は入力（キャッシュを含む）が 100,000 トークンを超えると全部が高い単価", () => {
    expect(
      estimateCostUsd("claude-haiku-5-5", {
        ...zero,
        inputTokens: 90_000,
        cacheReadTokens: 20_000,
        outputTokens: 10_000,
      }),
    ).toBeCloseTo(0.045 + 0.001 + 0.025);
  });
});

describe("parseLlmHeaders", () => {
  it("無ければどちらも undefined", () => {
    expect(parseLlmHeaders(new Headers())).toEqual({
      ok: true,
      model: undefined,
      effort: undefined,
    });
  });

  it("決めた値なら受け付ける", () => {
    const h = new Headers({
      "X-LLM-Model": "claude-opus-5-5",
      "X-LLM-Effort": "high",
    });
    expect(parseLlmHeaders(h)).toEqual({
      ok: true,
      model: "claude-opus-5-5",
      effort: "high",
    });
  });

  it.each([
    [{ "X-LLM-Model": "claude-fable-5-1" }],
    [{ "X-LLM-Model": "gpt" }],
    [{ "X-LLM-Effort": "max" }],
  ])("決めた値以外は断る: %o", (headers) => {
    expect(parseLlmHeaders(new Headers(headers)).ok).toBe(false);
  });

  it("型の判定", () => {
    expect(isLlmModel("claude-haiku-5-5")).toBe(true);
    expect(isLlmModel("claude-haiku-4-5")).toBe(false);
    expect(isLlmEffort("low")).toBe(true);
    expect(isLlmEffort("xhigh")).toBe(false);
  });
});
