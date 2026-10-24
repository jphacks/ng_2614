// ドメインの型。docs/design.md の「8. データ設計」に対応する。
// ここを変えるときは、先に設計書を更新する。

// 研究テーマ（研究の層）
export type ResearchTheme = {
  id: string;
  name: string;
  repo: string; // "owner/name"
  question: string; // 何を明らかにしたいか
  method: string; // どの手法で（ベースラインを含む）
  evaluation: string; // どう評価するか（評価指標など）
  updatedAt: string; // ISO 8601
};

// API に渡す研究の目的（id や更新日時を含まない部分）
export type ResearchPurpose = Pick<
  ResearchTheme,
  "name" | "question" | "method" | "evaluation"
>;

export type FindingType = "on_purpose" | "hidden_problem" | "extra_addition";

export type ResearchImpact = {
  exists: boolean;
  description: string;
};

export type Finding = {
  id: string;
  type: FindingType;
  summary: string;
  files: string[];
  // 以下は type が "hidden_problem" のときだけ
  error?: string; // エラー内容
  errorIsInferred?: boolean; // 差分などからの推測なら true
  fix?: string; // 対処方法
  researchImpact?: ResearchImpact;
  saved?: boolean; // 問題ログに保存したか
};

// 取り込み元。"claude_code_hook" は Claude Code のフック（F-13）で届いたもの
export type ReviewSource = "commit" | "claude_code_hook";

// 会話記録から取り出した、失敗したコマンドとその出力（F-13）
export type ObservedError = {
  // 失敗したコマンド（"failed"）か、成功したコマンドの出力に出たエラー（"in_output"）か。無いときは "failed"
  kind?: "failed" | "in_output";
  tool: string; // "Bash" など
  input: string; // 実行したコマンドなど
  output: string; // エラーの出力（送るときは2,000文字、保存するときは500文字まで）
};

// 取り込んだ変更と判定（実装の層）
export type Review = {
  id: string;
  themeId: string;
  source?: ReviewSource; // 無いときは "commit"（フック導入前のデータ）
  purpose: string; // 作業の目的（フックのときは今回の依頼文）
  commitSha: string; // フックのときは ""
  commitMessage: string; // フックのときは ""
  // 以下はフックのときだけ
  earlierPrompts?: string[]; // 同じ会話でそれまでにした依頼文（古い順、直近5件まで）
  observedErrors?: ObservedError[]; // 作業中に実際に起きたエラー
  generatedFiles?: string[]; // 実行でできたファイル（実験の出力。中身は送らない）
  aiReport?: string; // AI の最終報告（3,000文字まで）
  headMoved?: boolean; // 作業中に pull やブランチの切り替えがあった
  createdAt: string; // ISO 8601
  findings: Finding[];
};

export type QuestionLayer = "research" | "implementation";

// 先生が想定している解答の観点（F-8 の採点に使う）
export type Viewpoint = {
  id: string; // 質問の中で一意（"v1" など）
  text: string; // 1つの観点に1つの主張
  required: boolean; // true の観点がすべて言えたら「理解できた」で終える
};

// 先生モードの1つの質問の中のやりとり（問い返し）
export type TeacherTurn = {
  role: "teacher" | "student";
  text: string;
};

export type TeacherItem = {
  layer: QuestionLayer;
  question: string;
  findingId?: string; // 保存した問題についての質問なら、その Finding の id
  answer: string; // 学生の最後の回答
  feedback: string; // 最後の講評
  understood: boolean; // false のものを「答えられなかった点」として残す
  turns?: TeacherTurn[]; // 最初の質問からのやりとり全体（問い返し型になる前の記録には無い）
  viewpoints?: Viewpoint[]; // 想定解答の観点（観点による採点の前の記録には無い）
  covered?: string[]; // 言えた観点の id
};

// 先生モード
export type TeacherSession = {
  id: string;
  themeId: string;
  createdAt: string; // ISO 8601
  items: TeacherItem[];
};
