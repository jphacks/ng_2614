// AI を呼ぶ API のルートを包む（F-17）。X-LLM-Model / X-LLM-Effort を読んで文脈に置き、
// AI を呼んだ分の使用量を X-LLM-Usage で返す

import { jsonError } from "@/lib/http";
import { runWithLlm, type LlmContext } from "./context";
import { LLM_HEADERS, parseLlmHeaders } from "./models";

export function withLlm(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const choice = parseLlmHeaders(request.headers);
    if (!choice.ok) return jsonError(choice.error, 400);

    const context: LlmContext = { model: choice.model, effort: choice.effort };
    const response = await runWithLlm(context, () => handler(request));
    if (context.usage) {
      response.headers.set(LLM_HEADERS.usage, JSON.stringify(context.usage));
    }
    return response;
  };
}
