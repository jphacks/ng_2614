// 受け取り箱 API に入れる守り（設計書「Claude Code のフック（F-13）」の 3）。
// 合言葉の値は、ログにもエラーメッセージにも出さない。

import { createHash, timingSafeEqual } from "node:crypto";
import { researchCheckToken } from "@/lib/secrets";

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

// "host:port" / "[::1]:3000" から、ポートを除いたホスト名を取り出す（小文字）
function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(0, end + 1);
  }
  const colon = value.indexOf(":");
  return colon === -1 ? value : value.slice(0, colon);
}

// Host ヘッダーが localhost / 127.0.0.1 / [::1]（ポートは何でもよい）のときだけ true
export function isLocalHost(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  return LOCAL_HOSTNAMES.has(hostnameOf(host));
}

// 環境変数 RESEARCH_CHECK_TOKEN か、設定ファイル（F-18）の合言葉
function configuredToken(): string {
  return researchCheckToken();
}

// サーバーに合言葉が設定されているか（false なら受け取り箱は使えない）
export function isHookEnabled(): boolean {
  return configuredToken() !== "";
}

export type TokenCheck = "ok" | "disabled" | "invalid";

// Authorization: Bearer <RESEARCH_CHECK_TOKEN> を確かめる
export function checkHookToken(request: Request): TokenCheck {
  const expected = configuredToken();
  if (!expected) return "disabled";

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer[ \t]+(.+)$/i.exec(header.trim());
  if (!match) return "invalid";

  // 長さが違うと timingSafeEqual が例外を投げるので、同じ長さのハッシュにして比べる
  const a = createHash("sha256").update(match[1]).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}

// GET / DELETE 用：このアプリ自身の画面からのリクエストか
// - Sec-Fetch-Site があれば、same-origin（または、アドレスバーへの入力などの none）だけ通す
// - Origin があれば、そのホストが Host ヘッダーと同じものだけ通す
export function isFromThisApp(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    const host = request.headers.get("host");
    if (!host) return false;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false; // "null" など
    }
    if (originHost.toLowerCase() !== host.trim().toLowerCase()) return false;
  }
  return true;
}

// フックからの POST 用：ブラウザから送られたリクエストには Origin が付くので、付いていたら拒否する
export function hasOriginHeader(request: Request): boolean {
  return request.headers.has("origin");
}
