// 接続の設定（F-18）：Claude API キー・GitHub トークン・フックの合言葉を、手元の設定ファイルに置く。サーバー側だけで使う。
// 画面で入れた値（設定ファイル）を優先し、無ければ環境変数（web/.env.local）を使う。
// 値はログにもエラーメッセージにも出さない。

import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type StoredSecrets = {
  anthropicApiKey?: string;
  githubToken?: string;
  researchCheckToken?: string;
};

export type SecretKey = keyof StoredSecrets;

// テストでは TAZUNA_CONFIG で場所を変える
export function configPath(): string {
  return (
    process.env.TAZUNA_CONFIG?.trim() ||
    join(homedir(), ".tazuna", "config.json")
  );
}

// 画面に出すときは、ホームディレクトリを ~ にする
export function displayConfigPath(): string {
  const p = configPath();
  const home = homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

export function readSecrets(): StoredSecrets {
  try {
    const raw: unknown = JSON.parse(readFileSync(configPath(), "utf8"));
    if (typeof raw !== "object" || raw === null) return {};
    const obj = raw as Record<string, unknown>;
    const out: StoredSecrets = {};
    for (const key of [
      "anthropicApiKey",
      "githubToken",
      "researchCheckToken",
    ] as const) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
    }
    return out;
  } catch {
    return {}; // 無い・壊れている
  }
}

// null を渡した項目は消す。本人だけが読める権限（600）で、書きかけが残らないよう置き換える
export function writeSecrets(
  patch: Partial<Record<SecretKey, string | null>>,
): StoredSecrets {
  const next: StoredSecrets = { ...readSecrets() };
  for (const [key, value] of Object.entries(patch) as [
    SecretKey,
    string | null | undefined,
  ][]) {
    if (value === undefined) continue;
    if (value === null || !value.trim()) delete next[key];
    else next[key] = value.trim();
  }
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
  return next;
}

export type SecretSource = "app" | "env" | null;

function resolve(
  stored: string | undefined,
  envName: string,
): { value: string; source: SecretSource } {
  if (stored) return { value: stored, source: "app" };
  const env = process.env[envName]?.trim();
  if (env) return { value: env, source: "env" };
  return { value: "", source: null };
}

export function anthropicKey() {
  return resolve(readSecrets().anthropicApiKey, "ANTHROPIC_API_KEY");
}

export function githubToken() {
  return resolve(readSecrets().githubToken, "GITHUB_TOKEN");
}

export function hasAnthropicKey(): boolean {
  return anthropicKey().value !== "";
}

// フックの合言葉は環境変数を優先する（フックのスクリプトも web/.env.local を先に読むため）
export function researchCheckToken(): string {
  const env = process.env.RESEARCH_CHECK_TOKEN?.trim();
  if (env) return env;
  return readSecrets().researchCheckToken ?? "";
}

// 合言葉が無ければ作って保存する（アプリの画面が受け取り箱を見に来たときに呼ぶ）。保存できなければ ""
export function ensureResearchCheckToken(): string {
  const current = researchCheckToken();
  if (current) return current;
  try {
    const token = randomBytes(32).toString("hex");
    writeSecrets({ researchCheckToken: token });
    return token;
  } catch {
    return "";
  }
}

export function lastFour(value: string): string {
  return value.length > 8 ? value.slice(-4) : "";
}

export const MISSING_ANTHROPIC_KEY =
  "Claude API キーが設定されていません。設定画面の「接続」で入れてください";
