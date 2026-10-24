# JPHACKS 2026｜開発リファレンス

> 出典: [JPHACKS2026 参加者ガイドライン / 開発リファレンス](https://app.notion.com/p/84930d2bd18483a480e281b13665a57c)（Notion 最終更新 2026-10-06、取得 2026-10-24）
>
> ※Notion 側に、このツールでは読み取れないブロック（コピーボタン等）が多数ありました。本文のテキストはすべて取り込んでいますが、それらのブロックに中身があった場合は抜けている可能性があります。

> **このページは、JPHACKS参加者が「何を使えばよいか」で立ち止まらず、アイデアの検証とチーム開発に集中するための出発点です。**

## このリファレンスについて

### 対象

- ハッカソンへの参加が初めての方
- アプリやプロダクトを、アイデアから公開・発表まで作ったことがない方
- 「アプリは何から作り始め、どうやって公開するの？」というところから知りたい方
- GitHubを使ったチーム開発や、クラウドへのデプロイが初めての方
- AI開発ツールを使ってみたいが、選び方や注意点が分からない方

経験者も、チーム内で開発方法を揃えたり、必要なツールを探したりするための一覧として活用できます。

### 目的

限られた時間の中で、課題を見つけ、チームでアイデアを形にし、動くプロトタイプとして伝える必要があります。このページでは、その過程で役立つ開発ツール、フレームワーク、サービスを目的別に紹介します。

- チーム開発を始めるときの選択肢を知る
- 環境構築や定型作業にかかる時間を減らす
- AIを含む現在の開発ツールを安全に活用する
- 初めて触れる領域の調査を始める入口にする
- 実装だけでなく、設計、テスト、デプロイ、発表までを支援する

### 使い方

- 掲載ツールの利用は**必須ではありません**。作りたいプロダクトと必要な機能に合わせて選んでください
- 選択肢が分からないときは、掲載しているツール名や技術カテゴリを調査のキーワードとして使ってください
- 気になるツールは、公式ドキュメント、チュートリアル、サンプルを確認し、小さく試してから採用するのがおすすめ
- すべてを導入する必要はありません。必要なものだけを選びましょう
- このページは、特定のツールの利用を指定・保証するものではありません
- 料金、利用条件、年齢制限、データの取り扱い、無料枠は変更されるため、利用前に各公式サイトを確認してください

### ツール選定の基本方針

ハッカソンは、使ったことのない技術に挑戦する機会でもあります。経験の有無だけで候補を外すのではなく、まず「どんなプロダクトを作りたいか」「実現にどんな機能が必要か」から考えてみましょう。

1. **作りたいものに合っていること** — Web、モバイル、AI、リアルタイム処理など、必要な機能を実現できるものを選ぶ
2. **期間内に試せること** — チュートリアルやサンプルを使い、短時間で小さな動作確認ができるものを選ぶ
3. **情報を見つけやすいこと** — 公式ドキュメント、利用例、コミュニティの情報が充実しているか確認する
4. **チームで共有できること** — 一人の環境だけで動く状態を避け、他のメンバーが実行・確認できるようにする
5. **安全性と制約を確認できること** — APIキー、個人情報、権限、無料枠、課金上限を管理できるものを選ぶ

迷ったら、**作りたい体験を言葉にする → 必要な機能を分ける → このページから候補を2〜3個見つける → 最小のサンプルを動かす**、という順番で検討してください。

## まず最初に揃えるもの

1. **コード管理：** [GitHub](https://github.com/)
2. **タスク管理：** [GitHub Issues / Projects](https://github.com/features/issues)
3. **AI開発支援：** GitHub Copilot、Cursor、Claude Code など
4. **アプリの公開先：** Vercel、Railway、Cloudflare Workers など
5. **ドキュメント／デザイン：** README、Notion、Figma、Miro など

### 開発開始時のチェックリスト

- [ ] README に「解決したい課題」「対象ユーザー」「主要機能」「起動方法」を書いた
- [ ] GitHub リポジトリとタスク管理場所を作った
- [ ] 使用する技術と担当範囲をチームで共有した
- [ ] `.gitignore` と `.env.example` を用意した
- [ ] APIキーや個人情報を共有する方法を決めた
- [ ] 小さくても動く最初のバージョンをデプロイした

## 1. チームの進め方を決める

開発を始める前に、連絡手段と、決定事項を残す場所を決めておきましょう。

### コミュニケーション

- [Slack](https://slack.com/) — チャットと通知の集約
- [Discord](https://discord.com/) — 音声通話やコミュニティ型の連携
- [Miro](https://miro.com/) — ホワイトボードでの共同作業

重要な決定はチャットだけに残さず、README、Issue、Notion など、後から参照できる場所へ記録しましょう。

## 2. コードとファイルを共有する

### ソースコードとタスクの管理

[GitHub](https://github.com/) では、ソースコードだけでなく、Issue、Pull Request、レビュー、CI/CD をまとめて管理できます。

- タスク管理：[GitHub Issues / Projects](https://github.com/features/issues)
- 自動化：[GitHub Actions](https://github.com/features/actions)
- AI支援：[GitHub Copilot](https://github.com/features/copilot)
- 認証情報の検出：[Secret scanning](https://docs.github.com/code-security/secret-scanning/about-secret-scanning)
- Git入門：[サル先生のGit入門](https://backlog.com/ja/git-tutorial/)

GitHub 以外の選択肢:

- [Jira](https://www.atlassian.com/ja/software/jira) — 詳細なワークフローが必要なチーム向け
- [Notion](https://www.notion.com/ja) — 要件、議事録、調査結果、デモ手順の共有

#### 最低限のGitHub運用

- `main` へ直接 push せず、機能ごとにブランチと Pull Request を作る
- 大きな変更を一度に入れず、レビューできる単位に分ける
- Issue に「何を」「なぜ」「完了条件」を書く
- `.env`、APIキー、秘密鍵、個人情報をコミットしない
- README に環境構築手順と必要な環境変数名を書く。値そのものは書かない

### ファイル共有

- [Google Drive](https://www.google.com/intl/ja_jp/drive/) — ドキュメント、スライド、動画などの共同編集・共有
- [OneDrive](https://www.microsoft.com/ja-jp/microsoft-365/onedrive/online-cloud-storage) — Microsoft 365 を利用するチーム向け
- [Amazon S3](https://aws.amazon.com/jp/pm/serv-s3/) — アプリが扱う画像、動画、データの保存

動画、学習データ、大量の画像などを Git リポジトリへ直接入れると、clone や履歴管理が重くなります。ソースコードと大容量ファイルは保存先を分けましょう。

## 3. UIとシステムを設計する

### UI／プロトタイピング

- [Figma](https://www.figma.com/) — UI設計、プロトタイプ、共同編集
- [Miro](https://miro.com/) — アイデア整理、ユーザーフロー、ワークショップ
- [diagrams.net](https://app.diagrams.net/) — システム構成図、ER図、フローチャート

デザインを作り込む前に、「誰が」「どの場面で」「何を達成するか」を3〜5画面程度で表現してみましょう。

### AIでデザイン案を作る

- [Claude Design](https://claude.com/ja/product/design) — 会話しながらキャンバス上でUIモックアップ、プロトタイプ、資料を作成・編集。PPTX、PDF、HTMLへの書き出しや Claude Code への引き継ぎに対応
- [Figma Make](https://www.figma.com/ja-jp/make/) — プロンプトから動くプロトタイプを生成し、Figma上のデザインやコードと行き来できる
- [v0](https://v0.dev/) — Web UI のたたき台を生成

生成された画面は出発点として扱い、ユーザーの操作順と、実際に扱うデータの形に合っているかを確認しましょう。対象プラン、無料枠、生成物の権利関係は変わりやすいため、利用前に各公式サイトで確認してください。

### API設計・連携

フロントエンドとバックエンドを分担する場合は、実装前にリクエスト、レスポンス、エラー形式を共有してください。

- [OpenAPI / Swagger](https://swagger.io/) — API仕様を機械可読な形式で定義
- [Swagger Editor](https://editor.swagger.io/) — OpenAPI仕様の作成と確認
- [Postman](https://www.postman.com/api-design) — APIの設計、実行、テスト、共有
- [Bruno](https://www.usebruno.com/) — APIコレクションをファイルとしてGit管理しやすいクライアント

## 4. 技術スタックを選ぶ

作りたいプロダクトに必要な機能から、技術の組み合わせを考えます。流行だけで選ばず、実現したい体験との相性、学習に使える時間、チームで共有できるかを確認してください。

### Webフロントエンド／フルスタック

- [Next.js](https://nextjs.org/) — Reactベース。フロントエンドとサーバー機能を1つのプロジェクトで扱いやすい
- [Vite](https://vite.dev/) — React、Vue などの軽量なフロントエンド開発環境
- [Nuxt](https://nuxt.com/) — Vueベースのフルスタックフレームワーク
- [Tailwind CSS](https://tailwindcss.com/) — UIを短時間で組み立てやすいCSSフレームワーク
- [shadcn/ui](https://ui.shadcn.com/) — React向けの編集可能なUIコンポーネント集

### バックエンド／API

- [FastAPI](https://fastapi.tiangolo.com/) — Pythonで型付きAPIを素早く構築
- [NestJS](https://nestjs.com/) — TypeScriptで構造化されたバックエンドを構築
- [Laravel](https://laravel.com/) — PHPのWebアプリケーションフレームワーク
- [Spring](https://spring.io/) — Java／Kotlinを使うチーム向け
- [Ruby on Rails](https://rubyonrails.org/) — RubyでWebアプリを素早く構築

### モバイル

- [Flutter](https://flutter.dev/) — 1つのコードベースから iOS／Android／Web を開発
- [React Native](https://reactnative.dev/) — React／TypeScriptの経験を活かしたモバイル開発

### データベース・認証・BaaS

- [Supabase](https://supabase.com/) — PostgreSQL、認証、ストレージ、リアルタイム機能をまとめて利用
- [Firebase](https://firebase.google.com/) — 認証、データベース、ホスティング、分析などを統合

認証を自作するより、実績のあるサービスを利用する方が短期間では安全です。Row Level Security やアクセスルールを設定し、匿名ユーザーが全データを読み書きできないか確認してください。

## 5. AIを活用して実装を進める

### AIコーディング／コーディングエージェント

- [GitHub Copilot](https://github.com/features/copilot) — IDE、GitHub、CLIと連携しやすいAI開発支援
- [Cursor](https://cursor.com/) — コードベースを参照し、対話しながら複数ファイルを編集できるAIエディタ
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — ターミナルを中心に調査、編集、コマンド実行を行うエージェント
- [OpenAI Codex](https://openai.com/codex/) — クラウド環境やCLIから開発タスクを進めるコーディングエージェント
- [Gemini CLI](https://codelabs.developers.google.com/gemini-cli-hands-on) — Geminiをターミナルから利用するオープンソースのエージェント

AIに大きな機能を一度に任せるのではなく、「仕様を整理する」「1機能を実装する」「テストを追加する」「差分をレビューする」のように作業を小さく分けると、確認しやすくなります。

### プロンプトからアプリやUIを作る

- [v0](https://v0.dev/) — Web UIやフルスタックアプリのたたき台を生成
- [Bolt](https://bolt.new/) — ブラウザ上でアプリを生成・編集
- [Lovable](https://lovable.dev/) — 会話からWebアプリを作り、認証や外部サービスと連携
- [Replit Agent](https://replit.com/products/agent) — 開発環境、実装、実行、デプロイをまとめて進行

生成された認証、データベース権限、外部API連携は必ず確認してください。継続開発する場合は、コードを GitHub へ保存できるか、特定サービスから移行できるかも確認しましょう。

### AIアプリ／エージェントを作る

- [Dify](https://dify.ai/) — LLMワークフロー、RAG、エージェントをローコードで構築
- [LangChain / LangGraph](https://docs.langchain.com/) — モデルに依存しにくいエージェントやワークフローをコードで構築
- [Google AI Studio / Gemini API](https://ai.google.dev/) — Geminiを利用したプロトタイプとAPI開発
- [Hugging Face](https://huggingface.co/) — 公開モデル、データセット、デモの探索と利用

#### MCP

[MCP（Model Context Protocol）](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro) は、AIアプリと外部のデータやツールを接続するためのオープンな標準です。MCPサーバーによっては、AIにファイルの読み書きやコマンド実行を許可します。提供元、要求権限、送信データ、実行内容を確認し、必要最小限の権限で利用してください。

## 6. 開発環境を揃え、自動化する

### 開発環境

- [Docker](https://www.docker.com/) — アプリやデータベースの実行環境をコンテナとして共有
- [Dev Containers](https://containers.dev/) / [GitHub Codespaces](https://github.com/features/codespaces) — リポジトリ内の設定から共通の開発環境を立ち上げる

ハッカソンでは Docker 化自体が目的にならないようにしましょう。小規模なフロントエンドであれば、Node.js のバージョン固定と README だけで十分な場合もあります。

### CI/CD

[GitHub Actions](https://github.com/features/actions) で、Pull Request 時に次の処理を自動実行すると安全です。

- Lint／フォーマット
- 型チェック
- 単体テスト
- ビルド
- 依存関係とシークレットのチェック

## 7. アプリを公開する

### 素早く公開したい場合

- [Vercel](https://vercel.com/docs/deployments) — Next.js やフロントエンドのGit連携デプロイに向く
- [Cloudflare Workers](https://developers.cloudflare.com/workers) — エッジ上でAPIやWebアプリを実行
- [Railway](https://railway.com/) — Webサーバーやデータベースをまとめてデプロイしやすい

### 汎用クラウド

- [AWS](https://aws.amazon.com/jp/)
- [Microsoft Azure](https://azure.microsoft.com/ja-jp/)
- [Google Cloud](https://cloud.google.com/?hl=ja)
- [さくらのクラウド](https://cloud.sakura.ad.jp/)

利用上限、予算アラート、不要リソースの停止方法を事前に確認してください。LLM API、GPU、動画処理、ログ保存は予想以上に費用が発生することがあります。

## 8. 品質と安全性を確認する

### テスト

- [Vitest](https://vitest.dev/) — Viteと相性が良い JavaScript／TypeScript 向けテスト
- [Playwright](https://playwright.dev/) — Chromium、Firefox、WebKit に対応するE2Eテスト
- [pytest](https://docs.pytest.org/) — Python向けテストフレームワーク

最低限、次を確認しましょう。

- 主要なデモ導線
- 認証と権限
- 外部APIが失敗した場合
- データが空の場合
- スマートフォン表示

### エラー監視

- [Sentry](https://sentry.io/) — エラー、パフォーマンス、セッション情報の監視

エラーを画面に出すだけでなく、原因をログから追える状態にしてください。ただし、個人情報やAPIキーをログへ出してはいけません。

### AI・セキュリティの注意

- [GitHub Secret scanning](https://docs.github.com/code-security/secret-scanning/about-secret-scanning) を活用する
- APIキーはサーバー側で保持し、ブラウザへ配布しない
- 個人情報、機密情報、未公開データを許可なくAIサービスへ入力しない
- AIが生成したコード、文章、画像は、正確性、脆弱性、ライセンスを人間が確認する
- 外部入力をプロンプトへ渡す場合は、プロンプトインジェクションを前提に権限を制限する
- RAGや検索結果の内容を、そのままシステムへの命令として実行しない
- AIが提案したパッケージ名やAPI仕様が実在するか、公式ドキュメントで確認する
- データ削除、課金、メール送信などの重要操作には確認ステップを入れる
- AI／LLM固有のリスクは [OWASP GenAI LLM Top 10 2026](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) を参照する

## 9. プレゼンとデモを準備する

### 発表資料

- Google Slides／Canva／Figma Slides — チームで編集しやすいスライド作成
- [Reveal.js](https://revealjs.com/) — HTML／Markdownベースのプレゼンテーション
- [Speaker Deck](https://speakerdeck.com/) — PDFスライドの公開・共有

### デモ前チェックリスト

- [ ] 初見の人でも価値が分かるサンプルデータを入れた
- [ ] ネットワークや外部API障害に備え、録画またはスクリーンショットを用意した
- [ ] 本番用APIキー、課金上限、デモアカウントの権限を確認した
- [ ] スマートフォン、投影画面、音声、文字サイズを確認した
- [ ] 「誰の、どんな課題を、どう解決したか」を技術説明より先に伝えられる

## Appendix：構成例

技術の組み合わせを考えるための出発点です。作品の目的や必要な機能に合わせて変更してください。

### Webアプリを最短で作る

Next.js + Tailwind CSS + shadcn/ui + Supabase + Vercel

フロントエンド、認証、データベース、デプロイが1か所にまとまり、管理する環境が最も少なくなる構成です。

### LLM APIを呼ぶだけの場合

Next.js + Supabase + Vercel

モデルの呼び出しは Next.js のサーバー側（Route Handler など）から行います。APIキーがブラウザへ出ず、バックエンドを別に立てる必要もありません。

### Python固有のライブラリが必要な場合

Next.js または Vite + FastAPI + Supabase

画像処理、数値計算、音声処理、自前モデルなど、Pythonでしか実現できない処理がある場合の構成です。

- デプロイ先が2つになります（フロントエンドは Vercel、FastAPI は Railway など）
- フロントエンドとAPIのドメインが分かれるため、CORS の設定が必要です
- Supabase で認証する場合、発行されたトークンを FastAPI 側で検証する実装が必要です

### LLMワークフローを検証する

Dify + 使用するモデルAPI

RAG用のデータは Dify のナレッジベースに置けるため、まずは追加のデータベースなしで検証できます。

- デモ画面：Dify が提供する Web アプリをそのまま使うのが最短。独自UIが必要なら Next.js などから Dify の API を呼ぶ
- データベース：アプリ固有のデータ（ユーザー情報、履歴など）を保存する場合に Supabase を追加

### モバイルアプリを作る

Flutter、または React Native（Expo）+ Firebase または Supabase

React Native を選ぶ場合は Expo の利用を推奨。素の React Native は実機ビルドの環境構築に時間がかかります。

モバイルアプリは、Webのように「URLを開いてもらう」ことができません。審査員や来場者にどう見せるかを早い段階で決め、一度通しで試しておきましょう。

---

> **大切なのはツールの数や新しさではなく、誰のどんな課題を解決し、動く形で価値を伝えられるかです。**
