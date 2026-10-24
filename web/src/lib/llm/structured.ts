// Claude に JSON（zod スキーマ）で答えさせる共通の関数。サーバー側からだけ使う。

import type { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, getAnthropic } from "./client";

export class LlmError extends Error {}

export async function parseStructured<S extends z.ZodType>(params: {
  schema: S;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await getAnthropic().messages.parse({
    model: MODEL,
    max_tokens: params.maxTokens ?? 16000,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
    output_config: {
      effort: params.effort ?? "medium",
      format: zodOutputFormat(params.schema),
    },
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
