import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();
vi.mock("./client", () => ({
  MODEL: "claude-haiku-5-5",
  getAnthropic: () => ({ messages: { parse } }),
}));

const { runWithLlm } = await import("./context");
const { parseStructured, LlmError } = await import("./structured");
import type { LlmContext } from "./context";

const schema = z.object({ answer: z.string() });

function reply(stop_reason = "end_turn") {
  return {
    stop_reason,
    parsed_output: stop_reason === "end_turn" ? { answer: "ok" } : null,
    usage: {
      input_tokens: 500,
      output_tokens: 100,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: 20,
    },
  };
}

describe("parseStructured（F-17）", () => {
  beforeEach(() => parse.mockReset());

  it("設定が無ければ、標準のモデルと関数ごとのエフォートを使う", async () => {
    parse.mockResolvedValue(reply());
    await parseStructured({ schema, system: "s", user: "u", effort: "low" });
    expect(parse.mock.calls[0][0].model).toBe("claude-haiku-5-5");
    expect(parse.mock.calls[0][0].output_config.effort).toBe("low");
  });

  it("文脈のモデル・エフォートを優先し、使用量を足す", async () => {
    parse.mockResolvedValue(reply());
    const ctx: LlmContext = { model: "claude-sonnet-5-5", effort: "high" };
    await runWithLlm(ctx, () =>
      parseStructured({ schema, system: "s", user: "u", effort: "low" }),
    );
    expect(parse.mock.calls[0][0].model).toBe("claude-sonnet-5-5");
    expect(parse.mock.calls[0][0].output_config.effort).toBe("high");
    expect(ctx.usage).toMatchObject({
      model: "claude-sonnet-5-5",
      calls: 1,
      inputTokens: 500,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 20,
    });
  });

  it("途中で切れても、使った分は記録する", async () => {
    parse.mockResolvedValue(reply("max_tokens"));
    const ctx: LlmContext = {};
    await expect(
      runWithLlm(ctx, () =>
        parseStructured({ schema, system: "s", user: "u" }),
      ),
    ).rejects.toBeInstanceOf(LlmError);
    expect(ctx.usage?.calls).toBe(1);
  });
});
