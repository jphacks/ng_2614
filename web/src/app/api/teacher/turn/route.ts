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

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = turnRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("サーバーに ANTHROPIC_API_KEY が設定されていません", 500);
  }
  try {
    const result = await takeTurn(parsed.data);
    return NextResponse.json<TeacherTurnResponse>(result);
  } catch (e) {
    return teacherErrorResponse(e);
  }
}
