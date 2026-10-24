# web

プロダクト本体（Next.js）。設計は [docs/design.md](../docs/design.md) に従う。

## 動かし方

```bash
cd web
npm install
cp .env.example .env.local   # 値を入れる。.env.local はコミットしない
npm run dev                  # http://localhost:3000
```

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック |
| `npm test` | テスト（Vitest） |

## ディレクトリ

| パス | 内容 |
| --- | --- |
| `src/lib/types.ts` | ドメインの型（設計書「8. データ設計」） |
| `src/lib/api-types.ts` | 画面と API の契約（設計書「9. API」） |
| `src/lib/storage.ts` | localStorage への保存 |
| `src/lib/api-client.ts` | 画面から API を呼ぶ関数 |
| `src/lib/llm/` | Claude API まわり（サーバー側だけ） |
| `src/lib/github.ts` | GitHub API まわり（サーバー側だけ） |
| `src/lib/hook/` | フックの受け取り箱（diff の読み取り・メモリの箱・リクエストの守り。サーバー側だけ） |
| `src/app/api/` | API（Route Handlers） |
| `src/app/` | 画面 |

## フックの受け取り箱（F-13）

Claude Code のフックから届いた変更を、サーバーのメモリに一時的に置く API。データベースは使わず、アプリを再起動すると消える（最大 50 件、古いものから消える）。フックのスクリプトの入れ方は [hook/README.md](../hook/README.md)。

| API | 内容 |
| --- | --- |
| `POST /api/hook/changes` | フックのスクリプトが変更を送る。202 で `{ id }` を返す |
| `GET /api/hook/changes` | 届いている変更の一覧（`enabled` と、古い順の `changes`）。このアプリの画面から |
| `DELETE /api/hook/changes/[id]` | 1 件を取り出して削除する。無ければ 404 |

使うには `web/.env.local` に `RESEARCH_CHECK_TOKEN`（合言葉）を設定してアプリを再起動する。ランダムな文字列でよい（例：`openssl rand -hex 32` の出力）。設定が無いと `POST` は 503 を返し、`GET` は `enabled: false` を返す。フックのスクリプトも同じファイルからこの値を読む。

守り：

- `Host` ヘッダーが `localhost` / `127.0.0.1` / `[::1]` 以外のリクエストは 403
- `POST` は `Authorization: Bearer <RESEARCH_CHECK_TOKEN>` が必要（違えば 401）。`Origin` ヘッダーが付いたもの（ブラウザからのもの）は 403
- `GET` / `DELETE` は、このアプリ自身の画面からのものだけ（`Sec-Fetch-Site` が `same-origin` / `none` 以外、または `Origin` が `Host` と違うものは 403）
- 本文は 2,000,000 文字まで（超えたら 413）。件数や長さの上限を超えた分は、断らずに切り詰める（それまでの依頼文は直近 5 件、エラーは先頭 10 件、エラーの出力は 2,000 文字・入力は 500 文字まで）
- 合言葉・本文・差分はログに出さない
