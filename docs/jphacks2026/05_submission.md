# プロダクト開発・提出方法

> 出典: [JPHACKS2026 参加者ガイドライン / プロダクト開発・提出方法](https://app.notion.com/p/f8530d2bd184837d84e781f6b32996f3)（Notion 最終更新 2026-10-06、取得 2026-10-24）

JPHACKSでは参加者がより開発に時間を費やし、質の高いプロダクトを開発できるよう、GitHubを活用して作品情報を提出します。

## まずはじめに

- GitHubのアカウント作成・ログインは、イベント開始までにチーム全員が完了している状態にしてください。
- JPHACKSでは**GitHubを活用した製品情報の提出が審査上必須**です。以下の流れに従ってソースコードを正しく提出してください。審査の詳細は [審査基準＆審査方法](07_judging.md) を参照。

## 開発開始から作品提出の流れ

### Hack Day前

1. GitHub の JPHACKS organization からの招待を承認して参加する
2. 自分のチームリポジトリの確認

### Hack Day当日

3. 最終的に開発したプロダクトの登録・README.md の記入
4. 提出フォームによるプロダクト情報の最終提出

## 1. GitHub の JPHACKS organization からの招待を承認して参加する

### 1-1. 招待メールの確認

申請したメールアドレスに、以下のような招待メールが届いていることを確認し、本文中のリンクから招待を確認します（文中の氏名・ユーザ名は GitHub に登録されているもの）。

```txt
Hi shota nitta,

JPHACKSサポートアカウント has invited you to join the JPHACKS organization on GitHub. Head over to https://github.com/jphacks to check out JPHACKS's profile.

To join JPHACKS, follow this link:

https://github.com/orgs/jphacks/invitation?via_email=1

Some helpful tips:

- If you get a 404 page, make sure you're signed in as maximum80.
- You can also accept the invitation by visiting the organization page directly at https://github.com/jphacks

If you were not expecting this invitation, you can ignore this email.

Thanks,
The GitHub Team
```

### 1-2. チーム招待の承認

![](https://jphacks.github.io/2022-guideline/assets/images/submit1.png)

招待URLにアクセスすると、JPHACKS運営事務局からの招待を確認できます。"JOIN JPHACKS" ボタンをクリックして承認してください。

## 2. チームリポジトリの確認

### 2-1. チームIDの確認

JPHACKSのGitHub組織に所属したら、[チームページ](https://github.com/orgs/jphacks/teams) にアクセスすると、所属しているチームを閲覧できます。

![](https://jphacks.github.io/2022-guideline/assets/images/submit8.png)

```txt
ブロックID_年度IDチームID
```

が記載されたチームが表示されます。これが今回のチームIDです。

#### ブロックID

| 会場 | ブロックID |
| --- | --- |
| 札幌会場 | `sp` |
| 仙台会場 | `sd` |
| 金沢会場 | `kz` |
| 東京A会場 | `tka` |
| 東京B会場 | `tkb` |
| 名古屋会場 | `ng` |
| 大阪会場 | `os` |
| 広島会場 | `hs` |
| 福岡会場 | `fk` |
| 沖縄会場 | `ok` |

#### 年度ID

- 2026年度開催は `26` が頭に入ります。

#### チームID の例

- 札幌会場の01番のチーム: `sp_2601`
- 東京A会場の01番のチーム: `tka_2601`

### 2-2. チームリポジトリの確認

チームページからチームIDをクリックすると、チームの詳細ページが表示されます。

![](https://jphacks.github.io/2022-guideline/assets/images/submit2.png)

**Repository** をクリックしてください。

![](https://jphacks.github.io/2022-guideline/assets/images/submit3.png)

表示されたリポジトリが今回利用するリポジトリです。リポジトリ内に

- `README.md`：**最終提出に必要な項目が記載されたファイル**
- `LICENSE`：**ライセンスファイル**

の2つが既に保存されていることを確認してください。

![](https://jphacks.github.io/2022-guideline/assets/images/submit4.png)

## 3. 最終的に開発したプロダクトの登録・README.md の記入

- Hack Day の最終提出用のプロダクト概要として、**README.md をフォーマットに合わせて更新**してください。
- README.md には、必ず **「デモ動画のリンク」** 及び **「作品情報」** を含めてください（最低限機能が分かる程度で構いません）。
- 審査は **Hack Day 終了翌日の月曜日 AM8:00** に実施します。それまでにすべての情報を push および merge してください。

## 4. 提出フォームによるプロダクト情報の最終提出

- **Hack Day 2日目の 15:30 までに提出**。本フォームはスポンサー賞の決定に使用します。
- プロダクト提出フォームにアクセスし、必要事項を記入します。
- チーム決定時に配布されているエリアID・チームIDを入力してください。
- GitHub のプロジェクトURLを記入してください。
- **GitHub 以外のURLは受け付けていません。**

## 注意事項

- 一度プロダクト情報を提出した後でも、提出終了時刻までは再度修正した内容を提出できます。その際は最新のものを決定版として審査に使用します。
- 動画の提出は任意ですが、オンライン審査時に動画確認やデモの確認で閲覧されることがあります。
- **リポジトリはすべて「パブリックリポジトリ」です。** 外部サービスのトークンやAPIキーなど、公開するべきではない秘密情報の取り扱いに注意してください。※JPHACKS終了後にプライベートリポジトリへの変更を希望する場合は変更可能です。
- チームで複数のリポジトリを使用したい場合は用意するので、Slack で `@運営事務局` に連絡してください。
