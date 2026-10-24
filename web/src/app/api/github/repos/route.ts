// GET /api/github/repos
// private のリポジトリ名が含まれるので、このアプリの画面からだけ受け付ける（設計書「9. API・インターフェース」）
import { NextResponse } from "next/server";
import type { ReposResponse } from "@/lib/api-types";
import { fetchRepos, GithubApiError } from "@/lib/github";
import { isFromThisApp, isLocalHost } from "@/lib/hook/guard";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalHost(request) || !isFromThisApp(request)) {
    return jsonError("このアプリの画面からだけ使えます", 403);
  }
  try {
    const body = await fetchRepos();
    return NextResponse.json<ReposResponse>(body);
  } catch (e) {
    if (e instanceof GithubApiError) return jsonError(e.message, e.status);
    return jsonError(
      "リポジトリの一覧の取得中に予期しないエラーが発生しました",
      500,
    );
  }
}
