// DELETE /api/hook/changes/[id]：受け取り箱から 1 件取り出す（中身を返して削除する）。
// 先に取り出せたタブだけが判定するための API。

import { NextResponse } from "next/server";
import type { HookChangeResponse } from "@/lib/api-types";
import { isFromThisApp, isLocalHost } from "@/lib/hook/guard";
import { takeHookChange } from "@/lib/hook/inbox";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isLocalHost(request)) {
    return jsonError(
      "この API は localhost からだけ使えます（Host ヘッダーが localhost ではありません）",
      403,
    );
  }
  if (!isFromThisApp(request)) {
    return jsonError("このアプリの画面からだけ使えます", 403);
  }

  const { id } = await params;
  const change = takeHookChange(id);
  if (!change) {
    return jsonError(
      "その変更は受け取り箱にありません（ほかのタブが先に取り出した可能性があります）",
      404,
    );
  }
  return NextResponse.json<HookChangeResponse>({ change });
}
