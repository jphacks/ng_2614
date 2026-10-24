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
| `src/app/api/` | API（Route Handlers） |
| `src/app/` | 画面 |
