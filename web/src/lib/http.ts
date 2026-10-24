// Route Handlers で使う、レスポンスを返すための関数。

import { NextResponse } from "next/server";
import type { ApiError } from "./api-types";

export function jsonError(message: string, status: number) {
  return NextResponse.json<ApiError>({ error: message }, { status });
}
