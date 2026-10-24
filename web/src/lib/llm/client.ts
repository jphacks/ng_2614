// Claude API のクライアント。サーバー側（Route Handlers）からだけ使う。
// API キーは環境変数 ANTHROPIC_API_KEY から SDK が読む。コードに書かない。

import Anthropic from "@anthropic-ai/sdk";

// 費用を抑えるため Haiku を使う（docs/design.md の技術スタック）。判定の質が足りなければ Sonnet などに上げる
export const MODEL = "claude-haiku-5-5";

let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
