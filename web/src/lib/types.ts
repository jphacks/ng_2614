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

// 取り込んだ変更と判定（実装の層）
export type Review = {
  id: string;
  themeId: string;
  purpose: string; // 作業の目的
  commitSha: string;
  commitMessage: string;
  createdAt: string; // ISO 8601
  findings: Finding[];
};

export type QuestionLayer = "research" | "implementation";

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
};

// 先生モード
export type TeacherSession = {
  id: string;
  themeId: string;
  createdAt: string; // ISO 8601
  items: TeacherItem[];
};
