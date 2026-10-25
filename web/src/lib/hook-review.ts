// フック（F-13）で届いた変更を、判定の依頼（ReviewRequest）にするための関数

import type { DiffResponse, ReviewRequest } from "./api-types";
import type { ObservedError, ResearchTheme } from "./types";

export const NO_PROMPT_TEXT = "（依頼文が記録されていません）";

// 作業の目的：今回の依頼文。空なら、それまでの最後の依頼文。それも無ければ定型文
export function hookPurpose(prompt: string, earlierPrompts: string[]): string {
  if (prompt.trim()) return prompt;
  const last = [...earlierPrompts].reverse().find((p) => p.trim());
  return last ?? NO_PROMPT_TEXT;
}

export type HookExtras = {
  earlierPrompts: string[];
  observedErrors: ObservedError[];
  generatedFiles: string[];
  headMoved: boolean;
  aiReport?: string; // AI の最終報告
};

// 判定の依頼。差分は DiffResponse の形に直して渡す（sha / message / url は ""）
export function buildHookReviewRequest(
  theme: Pick<ResearchTheme, "name" | "question" | "method" | "evaluation">,
  purpose: string,
  commit: DiffResponse,
  extras: HookExtras,
): ReviewRequest {
  return {
    theme: {
      name: theme.name,
      question: theme.question,
      method: theme.method,
      evaluation: theme.evaluation,
    },
    purpose,
    commit,
    earlierPrompts: extras.earlierPrompts,
    observedErrors: extras.observedErrors,
    generatedFiles: extras.generatedFiles,
    headMoved: extras.headMoved,
    ...(extras.aiReport ? { aiReport: extras.aiReport } : {}),
  };
}
