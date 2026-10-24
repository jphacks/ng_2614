// POST /api/teacher/questions：研究の目的と保存した問題から、先生役の質問を作る。

import { NextResponse } from "next/server";
import type { TeacherQuestionsResponse } from "@/lib/api-types";
import { jsonError } from "@/lib/http";
import {
  generateQuestions,
  questionsRequestSchema,
  teacherErrorResponse,
  validationMessage,
} from "@/lib/llm/teacher";
import { withLlm } from "@/lib/llm/route";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handlePost(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = questionsRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("サーバーに ANTHROPIC_API_KEY が設定されていません", 500);
  }
  try {
    const result = await generateQuestions(parsed.data);
    return NextResponse.json<TeacherQuestionsResponse>(result);
  } catch (e) {
    return teacherErrorResponse(e);
  }
}

// モデル・エフォートをヘッダーで受け取り、使用量をヘッダーで返す（F-17）
export const POST = withLlm(handlePost);
