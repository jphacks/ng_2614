import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import type { LlmUsage } from "@/lib/api-types";
import { llmChoice, recordLlmUsage } from "./context";
import { withLlm } from "./route";

function post(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers,
  });
}

describe("withLlm", () => {
  it("ヘッダーのモデル・エフォートを、AI を呼ぶ側から読める", async () => {
    const handler = withLlm(async () => NextResponse.json(llmChoice()));
    const res = await handler(
      post({ "X-LLM-Model": "claude-sonnet-5-5", "X-LLM-Effort": "low" }),
    );
    expect(await res.json()).toEqual({
      model: "claude-sonnet-5-5",
      effort: "low",
    });
  });

  it("AI を呼んだ分を足して X-LLM-Usage で返す", async () => {
    const handler = withLlm(async () => {
      const counts = {
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      };
      recordLlmUsage("claude-haiku-5-5", counts);
      await Promise.all(
        [1, 2].map(async () => recordLlmUsage("claude-haiku-5-5", counts)),
      );
      return NextResponse.json({ ok: true });
    });
    const res = await handler(post());
    const usage = JSON.parse(
      res.headers.get("x-llm-usage") ?? "null",
    ) as LlmUsage;
    expect(usage).toMatchObject({
      model: "claude-haiku-5-5",
      calls: 3,
      inputTokens: 3000,
      outputTokens: 600,
    });
    expect(usage.costUsd).toBeCloseTo(
      (3 * (1000 * 0.1 + 200 * 0.5)) / 1_000_000,
    );
  });

  it("AI を呼ばなければ X-LLM-Usage を付けない", async () => {
    const res = await withLlm(async () => NextResponse.json({}))(post());
    expect(res.headers.get("x-llm-usage")).toBeNull();
  });

  it("失敗の応答でも、呼んだ分は返す", async () => {
    const res = await withLlm(async () => {
      recordLlmUsage("claude-opus-5-5", {
        inputTokens: 10,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      return NextResponse.json({ error: "x" }, { status: 502 });
    })(post());
    expect(res.status).toBe(502);
    expect(res.headers.get("x-llm-usage")).toContain("claude-opus-5-5");
  });

  it("決めた値以外のモデルは 400 で断り、ハンドラーを呼ばない", async () => {
    let called = false;
    const res = await withLlm(async () => {
      called = true;
      return NextResponse.json({});
    })(post({ "X-LLM-Model": "claude-fable-5-1" }));
    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });
});
