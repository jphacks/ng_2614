# Git チーム開発ルール

このリポジトリはチームで開発する。迷ったらこのルールに従う。

## ブランチ

| ブランチ | 役割 | 直接 push |
| --- | --- | --- |
| `main` | 審査・デモ用の安定版。審査員が見るのはこのブランチ | ✕ 禁止 |
| `develop` | 開発の統合先。各自の作業はここに集める | ✕ 禁止 |
| 作業ブランチ | 1つの機能・修正ごとに `develop` から切る | ○ 自分のブランチなら自由 |

### 作業ブランチの名前

`<種類>/<内容>` の形にする。内容は英小文字とハイフンで短く書く。

- `feature/login-page` — 機能追加
- `fix/upload-error` — バグ修正
- `docs/readme-demo` — ドキュメント
- `chore/setup-ci` — 設定・環境まわり

## 作業の流れ

```bash
# 1. develop を最新にしてから作業ブランチを切る
git switch develop
git pull origin develop
git switch -c feature/login-page

# 2. 作業してコミット（小さく、こまめに）
git add <ファイル>
git commit -m "feat: ログイン画面を追加"

# 3. push して develop 向けの PR を作る
git push -u origin feature/login-page
```

4. GitHub で `develop` 向けの PR を作る
5. 動作確認できたら、**作成者が自分で Squash merge してよい**（レビューの承認は必須にしない。見てほしいときはメンションする）
6. マージしたら作業ブランチは削除する

### develop の変更を取り込む

作業が長引いて `develop` が進んだら、こまめに取り込んでおく。コンフリクトは PR を出す人が自分のブランチで解消する。

```bash
git switch feature/login-page
git pull origin develop
```

## main への反映（リリース）

`develop` から `main` への PR を作ってマージする。

- **マージ方法は「Create a merge commit」にする**（Squash にしない）。Squash すると `main` と `develop` の履歴がずれて、次回以降の PR でコンフリクトが起きやすくなるため
- 反映する前に、`develop` でデモが通しで動くことを確認する
- 反映するタイミングの目安:

| いつ | 理由 |
| --- | --- |
| Day1 19:10 の中間発表の前 | 中間発表用 |
| Day2 15:00 の Code Freeze の前 | 最終発表・作品提出フォーム（15:30）用 |
| 10/26(月) AM8:00 の審査開始の前 | 審査はこの時点の `main` の内容で行われる。README（デモ動画リンク・作品情報）も含めて反映を終えておく |

## コミットメッセージ

`<接頭辞>: <内容>` の形にする。内容は日本語でよい。

| 接頭辞 | 用途 | 例 |
| --- | --- | --- |
| `feat` | 機能追加 | `feat: ログイン画面を追加` |
| `fix` | バグ修正 | `fix: 画像アップロードが失敗する問題を修正` |
| `docs` | ドキュメント | `docs: README にデモ動画のリンクを追加` |
| `style` | 見た目・フォーマット（動作は変わらない） | `style: ボタンの余白を調整` |
| `refactor` | 動作を変えない整理 | `refactor: API 呼び出しを関数にまとめる` |
| `test` | テスト | `test: 投稿処理のテストを追加` |
| `chore` | 設定・依存関係・その他 | `chore: ESLint を導入` |

Squash merge すると **PR のタイトルがそのまま `develop` のコミットメッセージになる**ので、PR のタイトルも同じ形式で書く。

## やってはいけないこと

- **機密情報（API キー、トークン、パスワード、`.env` など）をコミットしない。** このリポジトリは public。詳しくは [AGENTS.md](../AGENTS.md) を参照
- `main` と `develop` に直接 push しない
- `main` と `develop` に `git push --force` しない
- 他の人の作業ブランチに断りなく push しない
- 大きな動画・データセットなどをコミットしない（Google Drive などに置いてリンクを書く）
