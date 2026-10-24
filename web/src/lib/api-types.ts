// 画面と API（Route Handlers）の間の契約。docs/design.md の「9. API・インターフェース」に対応する。
// 画面側も API 側もこの型に合わせて実装する。変えるときは先に設計書を更新する。

import type {
  Finding,
  QuestionLayer,
  ResearchPurpose,
  TeacherTurn,
} from "./types";

// すべての API は失敗時にこの形で返す（HTTP ステータスは 4xx / 5xx）
export type ApiError = { error: string };

// GET /api/github/commits?repo=owner/name
export type CommitSummary = {
  sha: string;
  message: string; // コミットメッセージ全文
  author: string;
  date: string; // ISO 8601
  url: string; // GitHub 上のコミットの URL
};
export type CommitsResponse = { commits: CommitSummary[] };

// GET /api/github/diff?repo=owner/name&sha=...
export type DiffFile = {
  filename: string;
  status: string; // "added" | "modified" | "removed" | "renamed" など GitHub の値そのまま
  additions: number;
  deletions: number;
  patch?: string; // バイナリや巨大なファイルでは無い
};
export type DiffResponse = {
  sha: string;
  message: string;
  url: string;
  files: DiffFile[];
  truncated: boolean; // 大きすぎて一部のファイルや patch を省いたら true
};

// POST /api/review
export type ReviewRequest = {
  theme: ResearchPurpose;
  purpose: string; // 作業の目的
  commit: DiffResponse;
};
export type ReviewResponse = {
  findings: Finding[]; // id はサーバーで振る。saved は false
};

// POST /api/teacher/questions
export type TeacherQuestion = {
  layer: QuestionLayer;
  question: string;
  findingId?: string;
};
export type TeacherQuestionsRequest = {
  theme: ResearchPurpose;
  problems: Finding[]; // 問題ログに保存した hidden_problem
};
export type TeacherQuestionsResponse = { questions: TeacherQuestion[] };

// POST /api/teacher/feedback
export type TeacherFeedbackRequest = {
  theme: ResearchPurpose;
  question: TeacherQuestion;
  answer: string;
  problem?: Finding; // question.findingId に対応する問題
};
export type TeacherFeedbackResponse = {
  feedback: string;
  understood: boolean;
};

// POST /api/teacher/turn（問い返し型の先生モード）
export type TeacherTurnRequest = {
  theme: ResearchPurpose;
  question: TeacherQuestion;
  problem?: Finding; // question.findingId に対応する問題
  turns: TeacherTurn[]; // 最初の質問からのやりとり。最後は学生の発言
};
export type TeacherTurnResponse = {
  done: boolean; // true ならこの質問のやりとりを終える
  understood: boolean; // done が true のときだけ意味がある
  message: string; // done が false なら次の問い返し、true なら講評
};
