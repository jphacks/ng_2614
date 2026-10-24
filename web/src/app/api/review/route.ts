// POST /api/review：研究の目的・作業の目的・差分を受け取り、Finding[] を返す。

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ReviewResponse } from "@/lib/api-types";
import { jsonError } from "@/lib/http";
import { reviewCommit } from "@/lib/llm/review";
import { LlmError } from "@/lib/llm/structured";
import { withLlm } from "@/lib/llm/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// 長すぎる文字列は、エラーにせずサーバー側で切る（フックからは大きな出力が届きうる）
const clipped = (max: number) =>
  z.string().transform((s) => (s.length > max ? s.slice(0, max) : s));

const requestSchema = z.object({
  theme: z.object({
    name: z.string(),
    question: z.string(),
    method: z.string(),
    evaluation: z.string(),
  }),
  purpose: z.string().trim().min(1, "作業の目的を入力してください"),
  commit: z.object({
    sha: z.string(),
    message: z.string(),
    url: z.string(),
    files: z
      .array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number(),
          deletions: z.number(),
          patch: z.string().optional(),
        }),
      )
      .min(1, "変更されたファイルがありません"),
    truncated: z.boolean(),
  }),
  // 以下はフック（F-13）のときだけ
  earlierPrompts: z.array(clipped(4000)).max(5).optional(),
  observedErrors: z
    .array(
      z.object({
        kind: z.enum(["failed", "in_output"]).optional(),
        tool: clipped(100),
        input: clipped(500),
        output: clipped(2000),
      }),
    )
    .max(10)
    .optional(),
  generatedFiles: z.array(clipped(500)).max(200).optional(),
  headMoved: z.boolean().optional(),
  aiReport: clipped(3000).optional(),
});

async function handlePost(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(
      "リクエストの形式が正しくありません（JSON を送ってください）",
      400,
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join(" / ");
    return jsonError(`リクエストの内容が正しくありません。${detail}`, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("サーバーに ANTHROPIC_API_KEY が設定されていません", 500);
  }

  try {
    const findings = await reviewCommit(parsed.data);
    return NextResponse.json<ReviewResponse>({ findings });
  } catch (e) {
    if (e instanceof LlmError) return jsonError(e.message, 502);
    if (e instanceof Anthropic.RateLimitError) {
      return jsonError(
        "AI の利用が混み合っています。少し待ってからもう一度試してください",
        429,
      );
    }
    // 機密情報を出さないよう、メッセージだけを記録する
    console.error(
      "[api/review] 判定に失敗しました:",
      e instanceof Error ? e.message : "unknown error",
    );
    return jsonError("判定中にエラーが起きました。もう一度試してください", 500);
  }
}

// モデル・エフォートをヘッダーで受け取り、使用量をヘッダーで返す（F-17）
export const POST = withLlm(handlePost);
