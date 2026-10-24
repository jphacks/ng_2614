// Claude に JSON（zod スキーマ）で答えさせる共通の関数。サーバー側からだけ使う。

import type { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, getAnthropic } from "./client";
import { llmChoice, recordLlmUsage } from "./context";

export class LlmError extends Error {}

export async function parseStructured<S extends z.ZodType>(params: {
  schema: S;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  // 設定画面（F-17）で選んだモデル・エフォートがあれば、それを優先する
  const choice = llmChoice();
  const model = choice.model ?? MODEL;
  const response = await getAnthropic().messages.parse({
    model,
    max_tokens: params.maxTokens ?? 16000,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
    output_config: {
      effort: choice.effort ?? params.effort ?? "medium",
      format: zodOutputFormat(params.schema),
    },
  });

  // 途中で切れたり拒否されたりしても料金はかかるので、先に記録する
  recordLlmUsage(model, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  });

  if (response.stop_reason === "refusal") {
    throw new LlmError("AIが回答を拒否しました。入力内容を見直してください。");
  }
  if (response.stop_reason === "max_tokens") {
    throw new LlmError("AIの回答が長すぎて途中で切れました。");
  }
  if (response.parsed_output == null) {
    throw new LlmError("AIの回答を読み取れませんでした。");
  }
  return response.parsed_output as z.infer<S>;
}
