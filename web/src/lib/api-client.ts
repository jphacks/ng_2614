// 画面から API（Route Handlers）を呼ぶための関数。型は api-types.ts の契約に従う。
// 失敗したときは、API が返した error の文言で Error を投げる。

import type {
  ApiError,
  CommitsResponse,
  DiffResponse,
  ReviewRequest,
  ReviewResponse,
  TeacherFeedbackRequest,
  TeacherFeedbackResponse,
  TeacherQuestionsRequest,
  TeacherQuestionsResponse,
} from "./api-types";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error
        : `リクエストに失敗しました（${res.status}）`;
    throw new Error(message);
  }
  return body as T;
}

function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchCommits(repo: string): Promise<CommitsResponse> {
  const q = new URLSearchParams({ repo });
  return request<CommitsResponse>(`/api/github/commits?${q}`);
}

export function fetchDiff(repo: string, sha: string): Promise<DiffResponse> {
  const q = new URLSearchParams({ repo, sha });
  return request<DiffResponse>(`/api/github/diff?${q}`);
}

export function postReview(payload: ReviewRequest): Promise<ReviewResponse> {
  return postJson<ReviewResponse>("/api/review", payload);
}

export function postTeacherQuestions(
  payload: TeacherQuestionsRequest,
): Promise<TeacherQuestionsResponse> {
  return postJson<TeacherQuestionsResponse>("/api/teacher/questions", payload);
}

export function postTeacherFeedback(
  payload: TeacherFeedbackRequest,
): Promise<TeacherFeedbackResponse> {
  return postJson<TeacherFeedbackResponse>("/api/teacher/feedback", payload);
}
