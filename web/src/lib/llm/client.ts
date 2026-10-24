// Claude API のクライアント。サーバー側（Route Handlers）からだけ使う。
// API キーは、設定画面（F-18）で入れた値か環境変数 ANTHROPIC_API_KEY を lib/secrets.ts から読む。コードに書かない。

import Anthropic from "@anthropic-ai/sdk";
import { anthropicKey } from "@/lib/secrets";
import { DEFAULT_MODEL } from "./models";

// 費用を抑えるため Haiku を標準にする（docs/design.md の技術スタック）。
// 設定画面（F-17）で選ばれたモデルがあれば、そちらを使う（structured.ts）
export const MODEL = DEFAULT_MODEL;

let client: Anthropic | undefined;
let clientKey = "";

export function getAnthropic(): Anthropic {
  // 設定画面でキーが変わったら作り直す
  const key = anthropicKey().value;
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key });
    clientKey = key;
  }
  return client;
}
