// 画面から API（Route Handlers）を呼ぶための関数。型は api-types.ts の契約に従う。
// 失敗したときは、API が返した error の文言で Error を投げる。
// デモモード（F-12）のときは、サーバーを呼ばずにデモデータを返す。

import {
  demoCommits,
  demoDiff,
  demoReviewFindings,
  demoTeacherFeedback,
  demoTeacherQuestions,
  demoTeacherTurn,
} from "./demo/data";
import { isDemoMode } from "./demo/mode";
import { demoMapUpdate, demoWorkflowMap } from "./demo/workflow-map";
import type {
  ApiError,
  CommitsResponse,
  DiffResponse,
  HookChangeResponse,
  HookChangesResponse,
  MapGenerateRequest,
  MapGenerateResponse,
  MapUpdateRequest,
  MapUpdateResponse,
  ReviewRequest,
  ReviewResponse,
  TeacherFeedbackRequest,
  TeacherFeedbackResponse,
  TeacherQuestionsRequest,
  TeacherQuestionsResponse,
  TeacherTurnRequest,
  TeacherTurnResponse,
} from "./api-types";

// HTTP ステータスを持つエラー（404 だけ別に扱いたいときのため）
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const body = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error
        : `リクエストに失敗しました（${res.status}）`;
    throw new ApiRequestError(message, res.status);
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

// AI が考えている感じを出すため、デモデータは少し待ってから返す
function demo<T>(ms: number, make: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(make());
      } catch (e) {
        reject(e);
      }
    }, ms);
  });
}

export function fetchCommits(repo: string): Promise<CommitsResponse> {
  if (isDemoMode()) return demo(400, () => ({ commits: demoCommits }));
  const q = new URLSearchParams({ repo });
  return request<CommitsResponse>(`/api/github/commits?${q}`);
}

export function fetchDiff(repo: string, sha: string): Promise<DiffResponse> {
  if (isDemoMode()) {
    return demo(500, () => {
      const diff = demoDiff(sha);
      if (!diff) throw new Error("デモデータにこのコミットはありません");
      return diff;
    });
  }
  const q = new URLSearchParams({ repo, sha });
  return request<DiffResponse>(`/api/github/diff?${q}`);
}

export function postReview(payload: ReviewRequest): Promise<ReviewResponse> {
  if (isDemoMode()) {
    return demo(2500, () => ({
      findings: demoReviewFindings(payload.commit.sha),
    }));
  }
  return postJson<ReviewResponse>("/api/review", payload);
}

export function postTeacherQuestions(
  payload: TeacherQuestionsRequest,
): Promise<TeacherQuestionsResponse> {
  if (isDemoMode()) {
    return demo(1800, () => ({ questions: demoTeacherQuestions(payload) }));
  }
  return postJson<TeacherQuestionsResponse>("/api/teacher/questions", payload);
}

export function postTeacherTurn(
  payload: TeacherTurnRequest,
): Promise<TeacherTurnResponse> {
  if (isDemoMode()) return demo(1500, () => demoTeacherTurn(payload));
  return postJson<TeacherTurnResponse>("/api/teacher/turn", payload);
}

export function postTeacherFeedback(
  payload: TeacherFeedbackRequest,
): Promise<TeacherFeedbackResponse> {
  if (isDemoMode()) return demo(1500, () => demoTeacherFeedback(payload));
  return postJson<TeacherFeedbackResponse>("/api/teacher/feedback", payload);
}

// フック（F-13）の受け取り箱
export function fetchHookChanges(): Promise<HookChangesResponse> {
  return request<HookChangesResponse>("/api/hook/changes");
}

// 取り出すと受け取り箱から消える。ほかのタブが先に取っていたら 404（ApiRequestError）
export function takeHookChange(id: string): Promise<HookChangeResponse> {
  return request<HookChangeResponse>(
    `/api/hook/changes/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// 作業フローマップ（F-15）。今はデモモードでだけ動く（本物の Route Handlers は未実装）
const MAP_NOT_READY =
  "作業フローマップは、今はデモモードでだけ使えます。ヘッダーの「デモモード」を入れてください";

export function postMapGenerate(
  payload: MapGenerateRequest,
): Promise<MapGenerateResponse> {
  if (isDemoMode()) {
    return demo(2000, () => ({
      map: demoWorkflowMap(payload, new Date().toISOString()),
    }));
  }
  return Promise.reject(new Error(MAP_NOT_READY));
}

export function postMapUpdate(
  payload: MapUpdateRequest,
): Promise<MapUpdateResponse> {
  if (isDemoMode()) return demo(1500, () => demoMapUpdate(payload));
  return Promise.reject(new Error(MAP_NOT_READY));
}
