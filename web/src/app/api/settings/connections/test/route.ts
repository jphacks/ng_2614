// POST /api/settings/connections/test：今使われるキーで Claude API・GitHub を実際に呼び、使えるか確かめる（F-18）。
// キーの値はレスポンスにもログにも出さない。

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ConnectionTestResponse } from "@/lib/api-types";
import { fetchViewer, GithubApiError } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { anthropicKey, githubToken } from "@/lib/secrets";
import { guardSettings } from "@/lib/settings-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ target: z.enum(["anthropic", "github"]) });

function result(ok: boolean, message: string) {
  return NextResponse.json<ConnectionTestResponse>({ ok, message });
}

async function testAnthropic() {
  const key = anthropicKey().value;
  if (!key) return result(false, "Claude API キーが設定されていません");
  try {
    // モデルの一覧を 1 件だけ取る（料金はかからない）
    const client = new Anthropic({
      apiKey: key,
      maxRetries: 0,
      timeout: 15_000,
    });
    await client.models.list({ limit: 1 });
    return result(true, "Claude API に接続できました");
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return result(
        false,
        "キーが無効です。Console で発行したキーか確かめてください",
      );
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      return result(false, "このキーには権限がありません");
    }
    if (e instanceof Anthropic.RateLimitError) {
      return result(false, "混み合っています。少し待ってから試してください");
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return result(
        false,
        "Claude API に接続できませんでした（ネットワークを確かめてください）",
      );
    }
    return result(false, "Claude API の確認中にエラーが起きました");
  }
}

async function testGithub() {
  if (!githubToken().value)
    return result(false, "GitHub トークンが設定されていません");
  try {
    const { login } = await fetchViewer();
    return result(true, `GitHub に ${login} として接続できました`);
  } catch (e) {
    if (e instanceof GithubApiError && e.status === 401) {
      return result(
        false,
        "トークンが無効です。期限切れでないか確かめてください",
      );
    }
    return result(
      false,
      e instanceof GithubApiError
        ? e.message
        : "GitHub の確認中にエラーが起きました",
    );
  }
}

export async function POST(request: Request) {
  const denied = guardSettings(request);
  if (denied) return denied;

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) {
    return jsonError("target には anthropic か github を指定してください", 400);
  }
  return parsed.data.target === "anthropic" ? testAnthropic() : testGithub();
}
