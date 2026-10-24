// Claude API のクライアント。サーバー側（Route Handlers）からだけ使う。
// API キーは環境変数 ANTHROPIC_API_KEY から SDK が読む。コードに書かない。

import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL } from "./models";

// 費用を抑えるため Haiku を標準にする（docs/design.md の技術スタック）。
// 設定画面（F-17）で選ばれたモデルがあれば、そちらを使う（structured.ts）
export const MODEL = DEFAULT_MODEL;

let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
