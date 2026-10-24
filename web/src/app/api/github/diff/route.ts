// GET /api/github/diff?repo=owner/name&sha=...
import { NextResponse } from "next/server";
import type { DiffResponse } from "@/lib/api-types";
import {
  fetchDiff,
  GithubApiError,
  parseRepo,
  parseSha,
} from "@/lib/github";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const repo = parseRepo(params.get("repo"));
    const sha = parseSha(params.get("sha"));
    const body = await fetchDiff(repo, sha);
    return NextResponse.json<DiffResponse>(body);
  } catch (e) {
    if (e instanceof GithubApiError) return jsonError(e.message, e.status);
    return jsonError("差分の取得中に予期しないエラーが発生しました", 500);
  }
}
