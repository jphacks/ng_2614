// 先生モード（F-8）の議論を、全部の質問をつなげた1本のスレッドにするためのデータ変換。
// 画面の状態（完了した質問・今の質問）から、描画用のフラットなエントリの並びを作る。
// React にも DOM にも依存しない純粋な関数なので、テストしやすい。

import type { TeacherQuestion } from "./api-types";
import type { QuestionLayer, TeacherItem, TeacherTurn, Viewpoint } from "./types";

export type ThreadEntry =
  | {
      kind: "divider";
      key: string;
      questionNumber: number;
      total: number;
      layer: QuestionLayer;
    }
  | { kind: "message"; key: string; role: "teacher" | "student"; text: string }
  | {
      kind: "closing";
      key: string;
      text: string;
      understood: boolean;
      viewpoints: Viewpoint[];
      covered: string[];
    };

export function layerLabel(layer: QuestionLayer): string {
  return layer === "research" ? "研究手法" : "実装";
}

// 1つの質問のやりとりを message のエントリにする。key は質問の番号とターンの位置から決まる
function messages(i: number, turns: TeacherTurn[]): ThreadEntry[] {
  return turns.map((t, j) => ({
    kind: "message" as const,
    key: `q${i}-t${j}`,
    role: t.role,
    text: t.text,
  }));
}

export function buildThread(args: {
  questions: TeacherQuestion[];
  items: TeacherItem[];
  currentIndex: number;
  currentTurns: TeacherTurn[];
  currentResult: { feedback: string; understood: boolean } | null;
  currentCovered: string[];
}): ThreadEntry[] {
  const { questions, items, currentIndex, currentTurns, currentResult, currentCovered } = args;
  const entries: ThreadEntry[] = [];
  const last = Math.min(currentIndex, questions.length - 1);

  for (let i = 0; i <= last; i++) {
    const q = questions[i];
    entries.push({
      kind: "divider",
      key: `q${i}-divider`,
      questionNumber: i + 1,
      total: questions.length,
      layer: q.layer,
    });
    if (i > 0) {
      entries.push({
        kind: "message",
        key: `q${i}-intro`,
        role: "teacher",
        text: `次は${layerLabel(q.layer)}について聞きます。`,
      });
    }

    if (i < currentIndex) {
      // 完了した質問。items[i] から作る
      const item: TeacherItem | undefined = items[i];
      if (item?.turns && item.turns.length > 0) {
        // turns の最後は先生の講評（= item.feedback）なので、やりとりからは外す
        entries.push(...messages(i, item.turns.slice(0, -1)));
      } else {
        // 古い記録（turns が無い）や欠けた記録は、最初の質問だけを出す
        entries.push(...messages(i, [{ role: "teacher", text: q.question }]));
      }
      if (item) {
        entries.push({
          kind: "closing",
          key: `q${i}-closing`,
          text: item.feedback,
          understood: item.understood,
          viewpoints: item.viewpoints ?? q.viewpoints,
          covered: item.covered ?? [],
        });
      }
    } else {
      // 今の質問。講評が出ていれば、最後のターンがそれなので外す
      const turns = currentResult ? currentTurns.slice(0, -1) : currentTurns;
      entries.push(...messages(i, turns));
      if (currentResult) {
        entries.push({
          kind: "closing",
          key: `q${i}-closing`,
          text: currentResult.feedback,
          understood: currentResult.understood,
          viewpoints: q.viewpoints,
          covered: currentCovered,
        });
      }
    }
  }
  return entries;
}
