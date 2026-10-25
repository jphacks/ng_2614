// ブラウザの localStorage への保存。docs/design.md の「6. システム構成」で【仮】として決めた保存先。
// 画面（クライアントコンポーネント）からだけ呼ぶ。サーバー側では window が無いので空を返す。

import type { DiffResponse } from "./api-types";
import type {
  Finding,
  ObservedError,
  ResearchTheme,
  Review,
  TeacherPersona,
  TeacherSession,
  WorkflowMap,
} from "./types";

const KEYS = {
  themes: "rc.themes",
  reviews: "rc.reviews",
  teacherSessions: "rc.teacherSessions",
  hookDiffs: "rc.hookDiffs",
  maps: "rc.maps",
  teacherPersonas: "rc.teacherPersonas",
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

// プロジェクトを消す（F-1）。取り込んだ変更（判定）・先生モードの記録・作業フローマップもまとめて消す。
// 消した判定の id を返す（差分は IndexedDB にあるので、呼ぶ側で diff-store の deleteDiff で消す）
export function deleteTheme(id: string): string[] {
  write(
    KEYS.themes,
    read<ResearchTheme>(KEYS.themes).filter((t) => t.id !== id),
  );
  const reviews = read<Review>(KEYS.reviews);
  const removed = reviews.filter((r) => r.themeId === id).map((r) => r.id);
  write(KEYS.reviews, reviews.filter((r) => r.themeId !== id));
  write(
    KEYS.teacherSessions,
    read<TeacherSession>(KEYS.teacherSessions).filter((s) => s.themeId !== id),
  );
  // F-14 より前に localStorage に残していたフックの差分も、あれば消す
  const legacy = read<LegacyHookDiffEntry>(KEYS.hookDiffs);
  if (legacy.some((e) => removed.includes(e.reviewId))) {
    write(
      KEYS.hookDiffs,
      legacy.filter((e) => !removed.includes(e.reviewId)),
    );
  }
  deleteWorkflowMap(id);
  deleteTeacherPersona(id);
  notifyReviewsChanged();
  return removed;
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

// 判定結果（S-3）を開いたら、未確認の印を消す。変わったときだけ保存して知らせる
export function markReviewOpened(reviewId: string): Review | undefined {
  const review = getReview(reviewId);
  if (!review?.unopened) return review;
  const rest: Review = { ...review };
  delete rest.unopened;
  const saved = saveReview(rest);
  notifyReviewsChanged();
  return saved;
}

// 保存していない隠れた問題を、まとめて問題ログに保存する（S-3 の「まとめて保存して先生モードへ」）
export function saveAllHiddenProblems(reviewId: string): Review | undefined {
  const review = getReview(reviewId);
  if (!review) return undefined;
  return saveReview({
    ...review,
    findings: review.findings.map((f) =>
      f.type === "hidden_problem" && !f.saved ? { ...f, saved: true } : f,
    ),
  });
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

// 作業フローマップ（F-15）。研究テーマ1つにつき1件

// マップが変わったことを、開いている画面（上部の帯など）に知らせるイベント
export const MAPS_CHANGED_EVENT = "rc:maps-changed";

function notifyMapsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MAPS_CHANGED_EVENT));
}

export function getWorkflowMap(themeId: string): WorkflowMap | undefined {
  return read<WorkflowMap>(KEYS.maps).find((m) => m.themeId === themeId);
}

export function saveWorkflowMap(map: WorkflowMap): WorkflowMap {
  const maps = read<WorkflowMap>(KEYS.maps).filter(
    (m) => m.themeId !== map.themeId,
  );
  write(KEYS.maps, [...maps, map]);
  notifyMapsChanged();
  return map;
}

export function deleteWorkflowMap(themeId: string): void {
  write(
    KEYS.maps,
    read<WorkflowMap>(KEYS.maps).filter((m) => m.themeId !== themeId),
  );
  notifyMapsChanged();
}

// 先生のキャラクター（F-20）

export const DEFAULT_TEACHER_NAME = "先生";

export function getTeacherPersona(themeId: string): TeacherPersona | undefined {
  return read<TeacherPersona>(KEYS.teacherPersonas).find(
    (p) => p.themeId === themeId,
  );
}

// 保存できなかったとき（localStorage の容量が足りないなど）は Error を投げる
export function saveTeacherPersona(
  persona: Omit<TeacherPersona, "updatedAt">,
): TeacherPersona {
  const saved = { ...persona, updatedAt: nowIso() };
  const others = read<TeacherPersona>(KEYS.teacherPersonas).filter(
    (p) => p.themeId !== persona.themeId,
  );
  try {
    write(KEYS.teacherPersonas, [...others, saved]);
  } catch {
    throw new Error(
      "先生の設定を保存できませんでした。ブラウザの保存容量が足りない可能性があります。",
    );
  }
  return saved;
}

export function deleteTeacherPersona(themeId: string): void {
  const personas = read<TeacherPersona>(KEYS.teacherPersonas);
  if (!personas.some((p) => p.themeId === themeId)) return;
  write(
    KEYS.teacherPersonas,
    personas.filter((p) => p.themeId !== themeId),
  );
}
