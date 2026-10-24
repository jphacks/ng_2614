// 先生モード（F-8）の問い返しを終える条件。docs/design.md の「先生の聞き方」に対応する。
// サーバー（Claude を呼ぶ側）とデモモードの両方から使うので、ここには外部への依存を置かない。

import type { TeacherTurn, Viewpoint } from "./types";

// 1つの質問について、学生が答えられる回数の上限
export const MAX_STUDENT_TURNS = 3;

// 「分かりません」がこの回数続いたら、講評して終える
export const MAX_DONT_KNOW_STREAK = 2;

const DONT_KNOW = [
  "わからない",
  "わかりません",
  "分からない",
  "分かりません",
  "知らない",
  "知りません",
  "不明",
];

export function isDontKnow(text: string): boolean {
  const t = text.trim();
  return t === "" || DONT_KNOW.some((w) => t.includes(w));
}

export function countStudentTurns(turns: TeacherTurn[]): number {
  return turns.filter((t) => t.role === "student").length;
}

// 最後から数えて、学生が続けて「分かりません」と答えた回数
export function dontKnowStreak(turns: TeacherTurn[]): number {
  let streak = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== "student") continue;
    if (!isDontKnow(t.text)) break;
    streak++;
  }
  return streak;
}

// 次の先生の返答で、必ず講評して終えるか
export function mustFinish(turns: TeacherTurn[]): boolean {
  return (
    countStudentTurns(turns) >= MAX_STUDENT_TURNS ||
    dontKnowStreak(turns) >= MAX_DONT_KNOW_STREAK
  );
}

// ---- 観点による採点（docs/design.md の「観点による採点」） ----

export function allRequiredCovered(
  viewpoints: Viewpoint[],
  covered: string[],
): boolean {
  const required = viewpoints.filter((v) => v.required);
  return required.length > 0 && required.every((v) => covered.includes(v.id));
}

// 問い返しで狙う観点。終えるには必須がそろえばよいので、まだ言えていない必須の観点を先に狙う
export function firstUncovered(
  viewpoints: Viewpoint[],
  covered: string[],
): Viewpoint | undefined {
  const notYet = viewpoints.filter((v) => !covered.includes(v.id));
  return notYet.find((v) => v.required) ?? notYet[0];
}

// 引用の照合用。空白・句読点・記号を除き、英字を小文字にそろえる
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s、。，．,.!?！？「」『』（）()・:：;；"'`]/g, "");
}

// 根拠として引用された文が、学生の発言の中に本当にあるか
export function quoteFound(evidence: string, turns: TeacherTurn[]): boolean {
  const q = normalizeForMatch(evidence);
  if (q.length < 2) return false;
  return turns.some(
    (t) => t.role === "student" && normalizeForMatch(t.text).includes(q),
  );
}

// 今回の回答のあと、この質問を終えるか。終えるかどうかは AI ではなくここで決める
export function decideTurn(
  viewpoints: Viewpoint[],
  covered: string[],
  turns: TeacherTurn[],
): { done: boolean; understood: boolean } {
  if (allRequiredCovered(viewpoints, covered)) {
    return { done: true, understood: true };
  }
  return { done: mustFinish(turns), understood: false };
}
