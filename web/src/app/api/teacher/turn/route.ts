// POST /api/teacher/turn：質問とこれまでのやりとりから、先生役の次の問い返しか講評を返す。

import { NextResponse } from "next/server";
import type { TeacherTurnResponse } from "@/lib/api-types";
import { jsonError } from "@/lib/http";
import {
  takeTurn,
  teacherErrorResponse,
  turnRequestSchema,
  validationMessage,
} from "@/lib/llm/teacher";
import { withLlm } from "@/lib/llm/route";
import { hasAnthropicKey, MISSING_ANTHROPIC_KEY } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handlePost(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = turnRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400);
  }
  if (!hasAnthropicKey()) {
    return jsonError(MISSING_ANTHROPIC_KEY, 500);
  }
  try {
    const result = await takeTurn(parsed.data);
    return NextResponse.json<TeacherTurnResponse>(result);
  } catch (e) {
    return teacherErrorResponse(e);
  }
}

// モデル・エフォートをヘッダーで受け取り、使用量をヘッダーで返す（F-17）
export const POST = withLlm(handlePost);
