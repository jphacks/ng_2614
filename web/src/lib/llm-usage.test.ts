import { describe, expect, it } from "vitest";
import type { LlmUsage } from "./api-types";
import {
  addUsage,
  dayKey,
  KEEP_DAYS,
  parseUsageHeader,
  summarizeUsage,
  type UsageStore,
} from "./llm-usage";

const usage = (model: LlmUsage["model"], costUsd: number): LlmUsage => ({
  model,
  calls: 1,
  inputTokens: 1000,
  outputTokens: 100,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd,
});

describe("使用量の記録（F-17）", () => {
  it("同じ日・機能・モデルは足し合わせる", () => {
    let store: UsageStore = {};
    store = addUsage(
      store,
      "2026-10-24",
      "review",
      usage("claude-haiku-5-5", 0.001),
    );
    store = addUsage(
      store,
      "2026-10-24",
      "review",
      usage("claude-haiku-5-5", 0.002),
    );
    store = addUsage(
      store,
      "2026-10-24",
      "teacher",
      usage("claude-sonnet-5-5", 0.05),
    );
    const { rows, total } = summarizeUsage(store, "2026-10-24");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      feature: "teacher",
      model: "claude-sonnet-5-5",
      calls: 1,
    });
    expect(rows[1]).toMatchObject({
      feature: "review",
      calls: 2,
      inputTokens: 2000,
    });
    expect(total.calls).toBe(3);
    expect(total.costUsd).toBeCloseTo(0.053);
  });

  it("日付を指定しなければ全部の日をまとめる", () => {
    let store: UsageStore = {};
    store = addUsage(
      store,
      "2026-10-23",
      "map",
      usage("claude-haiku-5-5", 0.01),
    );
    store = addUsage(
      store,
      "2026-10-24",
      "map",
      usage("claude-haiku-5-5", 0.01),
    );
    expect(summarizeUsage(store, "2026-10-24").total.calls).toBe(1);
    expect(summarizeUsage(store).total.calls).toBe(2);
  });

  it(`直近 ${KEEP_DAYS} 日分だけ残す`, () => {
    let store: UsageStore = {};
    for (let i = 1; i <= KEEP_DAYS + 3; i++) {
      store = addUsage(
        store,
        dayKey(new Date(2026, 8, i)),
        "review",
        usage("claude-haiku-5-5", 0),
      );
    }
    expect(Object.keys(store)).toHaveLength(KEEP_DAYS);
    expect(store["2026-09-01"]).toBeUndefined();
  });

  it("ヘッダーの形が違えば記録しない", () => {
    expect(parseUsageHeader(null)).toBeUndefined();
    expect(parseUsageHeader("not json")).toBeUndefined();
    expect(
      parseUsageHeader(
        JSON.stringify({ ...usage("claude-haiku-5-5", 0), model: "x" }),
      ),
    ).toBeUndefined();
    expect(
      parseUsageHeader(
        JSON.stringify({ ...usage("claude-haiku-5-5", 0), costUsd: -1 }),
      ),
    ).toBeUndefined();
    expect(
      parseUsageHeader(JSON.stringify(usage("claude-opus-5-5", 0.1)))?.model,
    ).toBe("claude-opus-5-5");
  });
});
