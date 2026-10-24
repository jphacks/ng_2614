// 画面と API（Route Handlers）の間の契約。docs/design.md の「9. API・インターフェース」に対応する。
// 画面側も API 側もこの型に合わせて実装する。変えるときは先に設計書を更新する。

import type {
  Finding,
  MapOp,
  ObservedError,
  QuestionLayer,
  ResearchPurpose,
  Review,
  TeacherTurn,
  WorkflowMap,
  Viewpoint,
} from "./types";

// すべての API は失敗時にこの形で返す（HTTP ステータスは 4xx / 5xx）
export type ApiError = { error: string };

// GET /api/github/repos（新しいプロジェクト S-6 のリポジトリの一覧）
export type RepoSummary = {
  fullName: string; // owner/name
  private: boolean;
  description: string;
  language: string;
  pushedAt: string; // ISO 8601。最後に push した日時
  url: string; // GitHub 上のリポジトリの URL
};
export type ReposResponse = {
  tokenSet: boolean; // サーバーに GITHUB_TOKEN が無ければ false（一覧は空。手で入力してもらう）
  repos: RepoSummary[]; // 最後に push した順
};

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
// フック（F-13）で届いた変更では、commit の sha / message / url は "" にする
export type ReviewRequest = {
  theme: ResearchPurpose;
  purpose: string; // 作業の目的
  commit: DiffResponse;
  // 以下はフックのときだけ
  earlierPrompts?: string[]; // 同じ会話でそれまでにした依頼文（古い順、5件まで）
  observedErrors?: ObservedError[]; // 10件まで、output は2,000文字まで
  generatedFiles?: string[]; // 実行でできたファイル（中身は送らない）
  headMoved?: boolean; // 作業中に pull やブランチの切り替えがあった
  aiReport?: string; // AI の最終報告（3,000文字まで）。AI の自己申告
};
export type ReviewResponse = {
  findings: Finding[]; // id はサーバーで振る。saved は false
};

// POST /api/teacher/questions
export type TeacherQuestion = {
  layer: QuestionLayer;
  question: string;
  findingId?: string;
  viewpoints: Viewpoint[]; // 想定解答の観点。画面には講評まで出さない
};
export type TeacherQuestionsRequest = {
  theme: ResearchPurpose;
  problems: Finding[]; // 問題ログに保存した hidden_problem
};
export type TeacherQuestionsResponse = { questions: TeacherQuestion[] };

// POST /api/teacher/feedback
export type TeacherFeedbackRequest = {
  theme: ResearchPurpose;
  question: Pick<TeacherQuestion, "layer" | "question" | "findingId">;
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
  covered: string[]; // ここまでに言えた観点の id
};
export type TeacherTurnResponse = {
  done: boolean; // true ならこの質問のやりとりを終える
  understood: boolean; // done が true のときだけ意味がある
  message: string; // done が false なら次の問い返し、true なら講評
  covered: string[]; // 今回までに言えた観点の id（積み上げ）
};

// ---- Claude Code のフック（F-13） ----

// POST /api/hook/changes：フックのスクリプトが送る本文
// ヘッダー：Authorization: Bearer <RESEARCH_CHECK_TOKEN>、Content-Type: application/json
export type HookChangePayload = {
  repo: string; // 研究のリポジトリの owner/name（origin から。求められなければ ""）
  sessionId: string; // Claude Code の session_id
  prompt: string; // 今回の依頼文（記録が無ければ ""）
  earlierPrompts: string[]; // 同じ会話でそれまでにした依頼文（古い順、5件まで）
  diff: string; // git diff の出力（unified diff）。実験の出力のファイルは含めない
  generatedFiles: string[]; // 実行でできたファイル（中身は送らない）
  observedErrors: ObservedError[]; // 10件まで、output は2,000文字まで
  headMoved: boolean;
  aiReport?: string; // AI の最終報告（3,000文字まで）。会話記録が読めなければ無い
  createdAt: string; // フックで作った時刻（ISO 8601）
};
// 202 で返す
export type HookChangeAccepted = { id: string };

// 受け取り箱に置いた変更。diff はサーバーで DiffFile[] に分け、サイズの上限をかけてある
export type HookChange = Omit<HookChangePayload, "diff"> & {
  id: string;
  receivedAt: string; // ISO 8601
  files: DiffFile[];
  truncated: boolean;
};

// GET /api/hook/changes：一覧は軽くするため、差分などを含めない
export type HookChangeSummary = Pick<
  HookChange,
  "id" | "repo" | "prompt" | "createdAt" | "receivedAt"
>;
export type HookChangesResponse = {
  enabled: boolean; // サーバーに RESEARCH_CHECK_TOKEN が無ければ false（受け取り箱は使えない）
  changes: HookChangeSummary[]; // 古い順
};

// DELETE /api/hook/changes/[id]：受け取り箱から取り出す（中身を返して削除する）。無ければ 404
export type HookChangeResponse = { change: HookChange };

// ---- 作業フローマップ（F-15） ----
// デモモード（F-12）では api-client.ts がデモデータを返す。それ以外は Route Handlers が
// research-workspace（GitHub）と実装リポジトリを読み、Claude（Haiku 5.5）で目的などを補って返す

// POST /api/map/generate：research-workspace と実装リポジトリを読んでマップを作る（場面1）。
// 返すのは、そのときのワークスペースから作った新しいマップ。すでにマップがあるとき（作り直し）は、
// 画面が lib/map/merge.ts の diffToOps で差分を変更の一覧にし、applyMapOps で当てはめる
export type MapGenerateRequest = {
  themeId: string;
  theme: ResearchPurpose;
  repo: string; // 実装リポジトリ "owner/name"
  workspaceRepo?: string; // research-workspace "owner/name"（デモモードでは無くてよい）
  workspaceProject?: string; // .research/lab/projects/<project> の <project>
};
export type MapGenerateResponse = { map: WorkflowMap };

// POST /api/map/update：前回から変わったワークスペースのファイルと、取り込んだ判定から、
// マップへの変更の一覧を返す（場面3、と「ワークスペースから更新」ボタン）。
// review が無いときは、ワークスペースの変化だけを見る（ボタン）
export type MapUpdateRequest = {
  theme: ResearchPurpose;
  repo: string; // 実装リポジトリ "owner/name"
  map: WorkflowMap; // workspaceRepo・workspaceProject・workspaceSha を使う
  review?: Review;
};
export type MapUpdateResponse = {
  ops: MapOp[];
  workspaceSha?: string; // 今回読んだワークスペースのコミット
};
