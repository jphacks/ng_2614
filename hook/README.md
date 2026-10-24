# Claude Code のフック（F-13）

研究のリポジトリで Claude Code に作業を頼むたびに、**依頼文・AI が変えた差分・作業中に起きたエラー** を、手元で動かしているアプリ（`web/`）に自動で送るスクリプトです。アプリは送られた変更を研究の目的と照らして判定します。設計は [docs/design.md](../docs/design.md) の「Claude Code のフック（F-13）」にあります。

## 何をするか

`research-check.mjs` 1つを、Claude Code の `UserPromptSubmit`（依頼したとき）と `Stop`（AI が返事を終えたとき）の両方に登録します。

- 依頼したとき：依頼文を会話ごとの履歴に記録し、その時点の作業ツリー（未コミットの変更や新しいファイルも含む）のスナップショットを取る
- AI が返事を終えたとき：スナップショットと今の作業ツリーを比べて、AI が変えた差分を作り、アプリの `POST /api/hook/changes` に送る
  - 差分が空なら何も送らない
  - `.csv` `.log` `.png` `.pt` `.npy` `.parquet` などの実験の出力は、中身を送らずファイル名だけ送る
  - 1MB を超えるファイルは対象から外す
  - API キーやトークンらしい文字列は、送る前に `[伏せ字]` にする
- 画面には何も出さず、Claude Code を止めません（何があっても exit 0）。アプリが止まっていて送れなかった分は貯めておき、次に動いたときに送り直します

## 必要なもの

- Node.js 18 以上（依存パッケージは不要）
- git
- このリポジトリのアプリ（`web/`）が、同じ PC で動いていること（既定は `http://localhost:3000`）
- Claude Code

**Windows は、まだ動作を確認していません（対応していません）。** macOS と Linux で使ってください。

## 設定

### 1. 合言葉（このリポジトリ）

アプリとスクリプトで同じ合言葉（`RESEARCH_CHECK_TOKEN`）を使います。**ふつうは何もしなくてかまいません**。アプリの画面を一度開くと、アプリがランダムな合言葉を作って `~/.tazuna/config.json`（本人だけが読める権限）に保存し、スクリプトもそこから読みます。

自分で決めたいときは、**このリポジトリの `web/.env.local`** に書きます（`.env.local` はコミットされません。値をコミットしないでください）。こちらが優先されます。アプリを起動中に書き足したときは、アプリを再起動してください。

```
RESEARCH_CHECK_TOKEN=ここにランダムな文字列
```

スクリプトは、環境変数 `RESEARCH_CHECK_TOKEN` → `web/.env.local` → `~/.tazuna/config.json` の順に探します。

アプリが `localhost:3000` 以外で動いているときだけ、環境変数 `RESEARCH_CHECK_URL`（例：`http://localhost:3001`）を設定します。`web/.env.local` に書いてもかまいません。

### 2. 研究のリポジトリにフックを登録する

研究のリポジトリ（Claude Code を使うほう）に `.claude/settings.local.json` を作ります。これはコミットしない設定ファイルです。`/absolute/path/to/ng_2614` は、このリポジトリを置いた場所の絶対パスに変えてください。

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "node /absolute/path/to/ng_2614/hook/research-check.mjs" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "node /absolute/path/to/ng_2614/hook/research-check.mjs" }
        ]
      }
    ]
  }
}
```

設定したら、Claude Code を開き直す（またはそのセッションで `/hooks` を開いて確認する）と有効になります。

## 送られる内容（必ず読んでください）

次のものが、手元のアプリに送られ、判定のためにアプリから **Claude API にも送られます**。

- あなたの依頼文（今回と、同じ会話のそれまでの5件）
- AI が変えたコードの差分
- 作業中に失敗したコマンドと、その出力
- 実行でできたファイルの名前（中身は送りません）
- GitHub のリポジトリ名（`origin` から求めた `owner/name`）

API キーなどは伏せ字にしますが、完全ではありません。**ほかの人に見せたくないコードやデータがあるリポジトリでは登録しないでください。**

## 動いているか確かめる

1. アプリを起動し、画面（ブラウザ）を開いておく
2. 研究のリポジトリで Claude Code を開き、ファイルを少し変えさせる（例：「README に1行足して」）
3. 返事が終わって数秒以内に、アプリに判定が届く。研究テーマがその `owner/name` の GitHub リポジトリに登録されていると、そのテーマの目的と照らして判定される

届かないとき：

- 研究のリポジトリに `.git/research-check/sessions/` ができているか見る。できていなければ、フックが動いていない（設定のパスや JSON を確認する）
- `.git/research-check/outbox/` にファイルがあれば、送ろうとして失敗している。アプリが止まっている、合言葉がアプリとスクリプトで違う、URL が違う、のどれか。直して次に依頼すると送り直される
- 手で動かして確かめる（何も出ず、終了コードが 0 なら正常）：

```sh
cd 研究のリポジトリ
echo '{"hook_event_name":"UserPromptSubmit","session_id":"try","cwd":"'"$PWD"'","prompt":"試し"}' \
  | node /absolute/path/to/ng_2614/hook/research-check.mjs; echo "exit=$?"
```

## 状態の置き場所とリセット

研究のリポジトリの `.git/research-check/`（`git worktree` ごとに別）に置きます。`.git/` の中なので、コミットにも差分にも入りません。

- `sessions/<session_id>.json`：会話ごとの依頼の履歴と、スナップショットの記録
- `outbox/`：送れなかった内容（20件まで。古いものから消える）

おかしくなったときは、消すだけでリセットできます。次の依頼から作り直されます。

```sh
rm -rf .git/research-check
```

フックを止めたいときは、`.claude/settings.local.json` から登録を消してください。

## テスト

```sh
node --test hook/*.test.mjs   # このリポジトリのルートから
# または
cd hook && npm test
```

（Node 24 では `node --test hook/` のようにディレクトリを渡すと動かないので、ファイルを指定するか `npm test` を使います。）
