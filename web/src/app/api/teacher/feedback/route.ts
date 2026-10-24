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

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = feedbackRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("サーバーに ANTHROPIC_API_KEY が設定されていません", 500);
  }
  try {
    const result = await giveFeedback(parsed.data);
    return NextResponse.json<TeacherFeedbackResponse>(result);
  } catch (e) {
    return teacherErrorResponse(e);
  }
}
