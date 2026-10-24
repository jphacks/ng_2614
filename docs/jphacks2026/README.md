# JPHACKS2026 参加者ガイドライン（取り込み版）

Notion の [JPHACKS2026 参加者ガイドライン](https://app.notion.com/p/JPHACKS2026-52830d2bd18482cbbf8f01bd2b9f3ae8) を Markdown に取り込んだものです。

- 取得日：2026-10-24（Notion 側の最終更新：2026-10-06）
- 正となる情報は Notion と Slack（`jphacks2026.slack.com`）。運営からの最新の連絡を優先すること。

## 要点（名古屋会場・B日程）

このリポジトリ `ng_2614` は名古屋会場（ブロックID `ng`）のチームのもの。名古屋会場は **B日程：10/24(土)・25(日)**、会場は名城大学 天白キャンパス 研究実験棟Ⅲ innovation hub。

### 締め切り

| いつ | 何を |
| --- | --- |
| Day2 10/25(日) **15:00** | **Code Freeze**（開発終了） |
| Day2 10/25(日) **15:30** | **作品提出フォーム**を提出（スポンサー賞の判定に使われる。URL は GitHub のみ可） |
| Day2 10/25(日) 16:00〜 | Pitch Time（Google Meet で画面録画しながら発表。**デモを必ず含める**） |
| **10/26(月) AM8:00** | オンライン審査開始。**それまでに README（デモ動画リンク・作品情報）を含めすべて push / merge** |
| 10/30(金) 18:30〜 | Finalist Day（Award Day 進出の15チームを発表） |
| 11/15(日) | Award Day（東京大学 伊藤謝恩ホール、ピッチ8分＋展示） |

### ルールで特に注意すること

- **審査対象は Hack Day の2日間で開発した部分のみ。** 事前開発・持ち込みは可だが、事前に作った部分をメインの着眼点にするのは不可。事前開発物を期間中の成果と偽るのは反則（[開発のルール](04_rules.md) / [審査基準](07_judging.md#制約事項)）
- **リポジトリはパブリック**（MITライセンス）。APIキー・トークンなどの秘密情報をコミットしない
- README には **デモ動画のリンク** と **作品情報** を必ず書く
- 審査で最重要視されるのは **デモが実際に動くこと**。使った技術そのものは評価対象外で、問題解決が評価される
- 審査基準（各5点）：①問題着眼点・着想点 ②実行・実現可能性 ③完成度・動作性（＋Award Day のみ ④プレゼンテーション力）
- 各拠点から最低1チームは Award Day に進出できる

### 名古屋会場で狙えるスポンサー賞（Hack Day）

富士フイルム／インフィニオン／三菱重工 航空機・飛昇体事業部／Acompany。条件は [Sponsor Award](12_sponsor-awards.md#名古屋会場ngで狙える-hack-day-block-sponsor-award) を参照。

## 目次

### 全体概要

- [01 開催概要](01_overview.md)
- [02 事前準備物](02_preparation.md)（Slack / GitHub / Zoom）
- [03 開発のテーマ](03_theme.md)（"X-Tech 2026" 〜 Full Stack Hackers 〜）
- [04 開発のルール](04_rules.md)
- [05 プロダクト開発・提出方法](05_submission.md)
- [06 Hack Dayの流れ](06_hackday-flow.md)

### 審査・各賞案内

- [07 審査基準＆審査方法](07_judging.md)
- [08 JPHACKS Awards](08_awards.md)

### スポンサー関連

- [09 スポンサー紹介動画](09_sponsor-videos.md)
- [10 オリジナルスポンサーテーマ](10_sponsor-themes.md)
- [11 スポンサー提供物](11_sponsor-offerings.md)
- [12 Sponsor Award](12_sponsor-awards.md)
- [13 テクニカルパートナーからの提供物](13_technical-partners.md)

### 参考資料

- [14 開発リファレンス](14_dev-reference.md)
- [15 テクニカル学習コース（Track）](15_learning-courses.md)

### 参加規約

- [16 参加規約](16_terms.md)

## 原文の表記ゆれ・注意点

取り込み時に気づいた、Notion 原文の不整合です（内容は原文のまま残しています）。

- Award Day の開催日程の表に「2025年11月15日」と書かれている（2026年の誤記と思われる）
- Kaizen Sprint の終了日が、全体スケジュールでは 11/15(日)、詳細では 11/14(土) になっている
- Slack の招待元が「jphacks2025.slack.com」と書かれている箇所がある（他の箇所では `jphacks2026.slack.com`）
- 会場IDの書き方が場所によって違う（Slack の表示名の例は `tk_a_2501`、GitHub のチームIDは `tka_2601`。沖縄は GitHub では `ok`、会場 URL では `on`）
- 開発リファレンスとスポンサー紹介動画のページには、取り込みに使ったツールで読めないブロックがあった（本文のテキストは取り込み済み）
