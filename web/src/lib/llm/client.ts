// Claude API のクライアント。サーバー側（Route Handlers）からだけ使う。
// API キーは環境変数 ANTHROPIC_API_KEY から SDK が読む。コードに書かない。

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
