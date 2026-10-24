// 接続の設定 API（F-18）の守り：localhost で、このアプリの画面から来たものだけ通す。

import { isFromThisApp, isLocalHost } from "./hook/guard";
import { jsonError } from "./http";

// 通さないときはエラーのレスポンス、通すときは null
export function guardSettings(request: Request): Response | null {
  if (!isLocalHost(request)) {
    return jsonError(
      "この API は localhost からだけ使えます（Host ヘッダーが localhost ではありません）",
      403,
    );
  }
  if (!isFromThisApp(request)) {
    return jsonError("このアプリの画面からだけ使えます", 403);
  }
  return null;
}
