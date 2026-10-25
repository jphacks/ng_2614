// POST /api/teacher/feedback：質問と学生の回答から、先生役のフィードバックを返す。

import { NextResponse } from "next/server";
import type { TeacherFeedbackResponse } from "@/lib/api-types";
import { jsonError } from "@/lib/http";
import {
  feedbackRequestSchema,
  giveFeedback,
  teacherErrorResponse,
  validationMessage,
} from "@/lib/llm/teacher";
import { withLlm } from "@/lib/llm/route";
import { hasAnthropicKey, MISSING_ANTHROPIC_KEY } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handlePost(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = feedbackRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400);
  }
  if (!hasAnthropicKey()) {
    return jsonError(MISSING_ANTHROPIC_KEY, 500);
  }
  try {
    const result = await giveFeedback(parsed.data);
    return NextResponse.json<TeacherFeedbackResponse>(result);
  } catch (e) {
    return teacherErrorResponse(e);
  }
}

// モデル・エフォートをヘッダーで受け取り、使用量をヘッダーで返す（F-17）
export const POST = withLlm(handlePost);
