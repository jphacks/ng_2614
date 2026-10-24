import { describe, expect, it } from "vitest";
import { DEFAULT_LLM_SETTINGS, normalizeSettings } from "./llm-settings";

describe("AI の設定（F-17）", () => {
  it("何も無ければ、すべて Haiku 5.5・標準のエフォート", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_LLM_SETTINGS);
    expect(DEFAULT_LLM_SETTINGS.review).toEqual({
      model: "claude-haiku-5-5",
      effort: "default",
    });
  });

  it("使える値だけ拾い、壊れた値は標準に戻す", () => {
    expect(
      normalizeSettings({
        review: { model: "claude-sonnet-5-5", effort: "high" },
        teacher: { model: "claude-fable-5-1", effort: "max" },
      }),
    ).toEqual({
      review: { model: "claude-sonnet-5-5", effort: "high" },
      teacher: { model: "claude-haiku-5-5", effort: "default" },
      map: { model: "claude-haiku-5-5", effort: "default" },
    });
  });
});
