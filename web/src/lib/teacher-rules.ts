// 先生モード（F-8）の問い返しを終える条件。docs/design.md の「先生の聞き方」に対応する。
// サーバー（Claude を呼ぶ側）とデモモードの両方から使うので、ここには外部への依存を置かない。

import type { TeacherTurn } from "./types";

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
