// POST /api/hook/changes：フックのスクリプトから変更を受け取り、受け取り箱に置く。
// GET /api/hook/changes：受け取り箱に届いている変更の一覧（このアプリの画面から）。
// 守りは設計書「Claude Code のフック（F-13）」の 3。合言葉・本文・差分はログに出さない。

import { NextResponse } from "next/server";
import { z } from "zod";
import type { HookChangeAccepted, HookChangesResponse } from "@/lib/api-types";
import { diffToFiles } from "@/lib/hook/diff";
import {
  checkHookToken,
  hasOriginHeader,
  isFromThisApp,
  isHookEnabled,
  isLocalHost,
} from "@/lib/hook/guard";
import { addHookChange, listHookChanges } from "@/lib/hook/inbox";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 本文の上限（文字数）
const MAX_BODY_CHARS = 2_000_000;

// 件数・長さの上限。超えた分は、リクエストを断らずに切り詰める
// （古い依頼文は直近 5 件だけ残し、エラーは先頭の 10 件だけ残す）
const MAX_EARLIER_PROMPTS = 5;
const MAX_OBSERVED_ERRORS = 10;
const MAX_GENERATED_FILES = 200;
const MAX_ERROR_OUTPUT_CHARS = 2_000;
const MAX_ERROR_INPUT_CHARS = 500;
const MAX_PROMPT_CHARS = 10_000;
const MAX_SHORT_CHARS = 500; // repo・sessionId・ファイル名・tool など
const MAX_AI_REPORT_CHARS = 3_000;

const clip = (max: number) => (s: string) => s.slice(0, max);

const payloadSchema = z.object({
  repo: z.string().transform(clip(MAX_SHORT_CHARS)).default(""),
  sessionId: z.string().transform(clip(MAX_SHORT_CHARS)).default(""),
  prompt: z.string().transform(clip(MAX_PROMPT_CHARS)).default(""),
  earlierPrompts: z
    .array(z.string().transform(clip(MAX_PROMPT_CHARS)))
    .transform((a) => a.slice(-MAX_EARLIER_PROMPTS))
    .default([]),
  diff: z.string(),
  generatedFiles: z
    .array(z.string().transform(clip(MAX_SHORT_CHARS)))
    .transform((a) => a.slice(0, MAX_GENERATED_FILES))
    .default([]),
  observedErrors: z
    .array(
      z.object({
        kind: z.enum(["failed", "in_output"]).optional(),
        tool: z.string().transform(clip(MAX_SHORT_CHARS)),
        input: z.string().transform(clip(MAX_ERROR_INPUT_CHARS)),
        output: z.string().transform(clip(MAX_ERROR_OUTPUT_CHARS)),
      }),
    )
    .transform((a) => a.slice(0, MAX_OBSERVED_ERRORS))
    .default([]),
  headMoved: z.boolean().default(false),
  aiReport: z.string().transform(clip(MAX_AI_REPORT_CHARS)).optional(),
  createdAt: z
    .string()
    .transform(clip(MAX_SHORT_CHARS))
    .default(() => new Date().toISOString()),
});

export async function POST(request: Request) {
  if (!isLocalHost(request)) {
    return jsonError(
      "この API は localhost からだけ使えます（Host ヘッダーが localhost ではありません）",
      403,
    );
  }
  if (hasOriginHeader(request)) {
    return jsonError(
      "ブラウザからのリクエストは受け付けません（フックのスクリプトから送ってください）",
      403,
    );
  }

  const token = checkHookToken(request);
  if (token === "disabled") {
    return jsonError(
      "受け取り箱は無効です。web/.env.local に RESEARCH_CHECK_TOKEN を設定して、アプリを再起動してください",
      503,
    );
  }
  if (token === "invalid") {
    return jsonError(
      "合言葉が違います。Authorization ヘッダーに、web/.env.local の RESEARCH_CHECK_TOKEN を Bearer で付けてください",
      401,
    );
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return jsonError("リクエストの本文を読み取れませんでした", 400);
  }
  if (text.length > MAX_BODY_CHARS) {
    return jsonError(
      `リクエストが大きすぎます（${MAX_BODY_CHARS.toLocaleString("en-US")} 文字まで）`,
      413,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(
      "リクエストの形式が正しくありません（JSON を送ってください）",
      400,
    );
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    // 本文の値は出さず、どの項目が悪いかだけを返す
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join(" / ");
    return jsonError(`リクエストの内容が正しくありません。${detail}`, 400);
  }

  const { diff, ...rest } = parsed.data;
  const { files, truncated } = diffToFiles(diff);
  if (files.length === 0) {
    return jsonError(
      "diff から変更されたファイルを読み取れませんでした（git diff の出力を送ってください）",
      400,
    );
  }

  const change = addHookChange({ ...rest, files, truncated });
  return NextResponse.json<HookChangeAccepted>(
    { id: change.id },
    { status: 202 },
  );
}

export async function GET(request: Request) {
  if (!isLocalHost(request)) {
    return jsonError(
      "この API は localhost からだけ使えます（Host ヘッダーが localhost ではありません）",
      403,
    );
  }
  if (!isFromThisApp(request)) {
    return jsonError("このアプリの画面からだけ使えます", 403);
  }

  const enabled = isHookEnabled();
  return NextResponse.json<HookChangesResponse>({
    enabled,
    changes: enabled ? listHookChanges() : [],
  });
}
