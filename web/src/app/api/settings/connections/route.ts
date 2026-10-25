// GET /api/settings/connections：Claude API キーと GitHub トークンの状態を返す（値は返さない）。
// PUT /api/settings/connections：画面で入れたキーを設定ファイルに保存する・消す（F-18）。

import { NextResponse } from "next/server";
import { z } from "zod";
import type { ConnectionsResponse, ConnectionStatus } from "@/lib/api-types";
import { jsonError } from "@/lib/http";
import {
  anthropicKey,
  displayConfigPath,
  githubToken,
  lastFour,
  writeSecrets,
} from "@/lib/secrets";
import { guardSettings } from "@/lib/settings-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// キーに改行や空白は入らない。長さは余裕を持たせて上限だけ決める
const keyValue = z
  .string()
  .trim()
  .min(1, "空のままでは保存できません（消すときは削除を押してください）")
  .max(500, "長すぎます")
  .regex(/^\S+$/, "空白や改行は入れられません");

const updateSchema = z
  .object({
    anthropic: keyValue.nullable().optional(),
    github: keyValue.nullable().optional(),
  })
  .strict();

function status(resolved: {
  value: string;
  source: ConnectionStatus["source"];
}): ConnectionStatus {
  return {
    source: resolved.source,
    last4: resolved.source === "app" ? lastFour(resolved.value) : "",
  };
}

function currentStatus(): ConnectionsResponse {
  return {
    anthropic: status(anthropicKey()),
    github: status(githubToken()),
    configPath: displayConfigPath(),
  };
}

export async function GET(request: Request) {
  const denied = guardSettings(request);
  if (denied) return denied;
  return NextResponse.json<ConnectionsResponse>(currentStatus());
}

export async function PUT(request: Request) {
  const denied = guardSettings(request);
  if (denied) return denied;

  const json = await request.json().catch(() => undefined);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    // 入力された値は返さない
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join(" / ");
    return jsonError(`入力が正しくありません。${detail}`, 400);
  }

  try {
    writeSecrets({
      anthropicApiKey: parsed.data.anthropic,
      githubToken: parsed.data.github,
    });
  } catch (e) {
    console.error(
      "[api/settings/connections] 保存に失敗しました:",
      e instanceof Error ? e.name : "unknown error",
    );
    return jsonError(
      `設定ファイル（${displayConfigPath()}）に保存できませんでした`,
      500,
    );
  }
  return NextResponse.json<ConnectionsResponse>(currentStatus());
}
