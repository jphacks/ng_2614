// ブラウザの localStorage への保存。docs/design.md の「6. システム構成」で【仮】として決めた保存先。
// 画面（クライアントコンポーネント）からだけ呼ぶ。サーバー側では window が無いので空を返す。

import type { DiffResponse } from "./api-types";
import type {
  Finding,
  ObservedError,
  ResearchTheme,
  Review,
  TeacherSession,
} from "./types";

const KEYS = {
  themes: "rc.themes",
  reviews: "rc.reviews",
  teacherSessions: "rc.teacherSessions",
  hookDiffs: "rc.hookDiffs",
} as const;

// 判定の一覧が変わったことを、開いている画面に知らせるイベント
export const REVIEWS_CHANGED_EVENT = "rc:reviews-changed";

export function notifyReviewsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT));
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// 研究テーマ

export function listThemes(): ResearchTheme[] {
  return read<ResearchTheme>(KEYS.themes).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

// リポジトリ（owner/name）から研究テーマを探す。大文字小文字と前後の空白は無視し、
// 複数あれば最後に更新したもの
export function findThemeByRepo(repo: string): ResearchTheme | undefined {
  const key = repo.trim().toLowerCase();
  if (!key) return undefined;
  return listThemes().find((t) => t.repo.trim().toLowerCase() === key);
}

export function getTheme(id: string): ResearchTheme | undefined {
  return read<ResearchTheme>(KEYS.themes).find((t) => t.id === id);
}

// id が既にあれば更新、無ければ追加する。updatedAt はここで付け直す
export function saveTheme(theme: ResearchTheme): ResearchTheme {
  const saved = { ...theme, updatedAt: nowIso() };
  const themes = read<ResearchTheme>(KEYS.themes).filter(
    (t) => t.id !== theme.id,
  );
  write(KEYS.themes, [...themes, saved]);
  return saved;
}

// 判定（Review）

export function listReviews(themeId: string): Review[] {
  return read<Review>(KEYS.reviews)
    .filter((r) => r.themeId === themeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReview(id: string): Review | undefined {
  return read<Review>(KEYS.reviews).find((r) => r.id === id);
}

export function saveReview(review: Review): Review {
  const reviews = read<Review>(KEYS.reviews).filter((r) => r.id !== review.id);
  write(KEYS.reviews, [...reviews, review]);
  return review;
}

// フックの判定（F-13）

export const OBSERVED_ERROR_SAVE_LIMIT = 500; // 保存するエラー出力の最大文字数

// 保存するときは、エラーの出力を500文字までに切る（localStorage の容量のため）
export function cutObservedErrors(errors: ObservedError[]): ObservedError[] {
  return errors.map((e) => ({
    ...e,
    output: e.output.slice(0, OBSERVED_ERROR_SAVE_LIMIT),
  }));
}

// フックで届いた判定を保存する。エラー出力は切る（差分は diff-store.ts の saveDiff で別に保存する）
export function saveHookReview(review: Review): Review {
  const saved = saveReview({
    ...review,
    observedErrors: cutObservedErrors(review.observedErrors ?? []),
  });
  notifyReviewsChanged();
  return saved;
}

type LegacyHookDiffEntry = { reviewId: string; commit: DiffResponse };

// F-14 より前は、フックの判定の直近5件の差分を localStorage に残していた。その読み出しだけ残す
export function getLegacyHookDiff(reviewId: string): DiffResponse | undefined {
  return read<LegacyHookDiffEntry>(KEYS.hookDiffs).find(
    (e) => e.reviewId === reviewId,
  )?.commit;
}

export function updateFinding(
  reviewId: string,
  findingId: string,
  patch: Partial<Omit<Finding, "id">>,
): Review | undefined {
  const review = getReview(reviewId);
  if (!review) return undefined;
  const updated: Review = {
    ...review,
    findings: review.findings.map((f) =>
      f.id === findingId ? { ...f, ...patch } : f,
    ),
  };
  return saveReview(updated);
}

// 問題ログ：保存した隠れた問題を、新しい順に返す
export type SavedProblem = { review: Review; finding: Finding };

export function listSavedProblems(themeId: string): SavedProblem[] {
  return listReviews(themeId).flatMap((review) =>
    review.findings
      .filter((f) => f.type === "hidden_problem" && f.saved)
      .map((finding) => ({ review, finding })),
  );
}

// 先生モード

export function listTeacherSessions(themeId: string): TeacherSession[] {
  return read<TeacherSession>(KEYS.teacherSessions)
    .filter((s) => s.themeId === themeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveTeacherSession(session: TeacherSession): TeacherSession {
  const sessions = read<TeacherSession>(KEYS.teacherSessions).filter(
    (s) => s.id !== session.id,
  );
  write(KEYS.teacherSessions, [...sessions, session]);
  return session;
}
