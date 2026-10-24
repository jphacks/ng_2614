// GET /api/github/commits?repo=owner/name
import { NextResponse } from "next/server";
import type { CommitsResponse } from "@/lib/api-types";
import { fetchCommits, GithubApiError, parseRepo } from "@/lib/github";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const repo = parseRepo(params.get("repo"));
    const body = await fetchCommits(repo);
    return NextResponse.json<CommitsResponse>(body);
  } catch (e) {
    if (e instanceof GithubApiError) return jsonError(e.message, e.status);
    return jsonError("コミットの取得中に予期しないエラーが発生しました", 500);
  }
}
