// ピッチ用の入口（/pitch）で、デモを毎回同じ状態から始められるように用意する（docs/design.md の「ピッチ用の入口」）。
// デモ用のプロジェクトだけを作り直し、ほかのプロジェクトには触れない。画面（クライアント）からだけ呼ぶ。

import { deleteDiff, saveDiff } from "@/lib/diff-store";
import { setStripOpen, setStripOrientation } from "@/lib/map/prefs";
import { deleteTheme, nowIso, saveHookReview, saveTheme, saveWorkflowMap } from "@/lib/storage";
import type { Review } from "@/lib/types";
import { DEMO_THEME_ID, MAIN_SHA, demoDiff, demoReviewFindings, demoTheme } from "./data";
import { setDemoMode } from "./mode";
import { demoWorkflowMap } from "./workflow-map";

export const PITCH_REVIEW_ID = "pitch-review";

const PITCH_PROMPT =
  "cosine スケジュールを追加して、linear と seed 3 つで比べる compare.py を作って。評価は README のとおり sliced Wasserstein 距離で。";

const PITCH_EARLIER_PROMPTS = ["DDPM のベースライン（linear スケジュール）の学習とサンプリングを動くようにして"];

const PITCH_ERRORS = [
  {
    kind: "in_output" as const,
    tool: "Bash",
    input: "python compare.py --schedule cosine --seed 0",
    output: "step 1200 | loss nan\nRuntimeWarning: invalid value encountered in subtract",
  },
  {
    kind: "in_output" as const,
    tool: "Bash",
    input: "python sample.py --schedule cosine",
    output: "warning: 312 / 2000 samples are outside [-50, 50]",
  },
];

const PITCH_AI_REPORT =
  "cosine スケジュールを追加し、compare.py で linear と seed 3 つで比べられるようにしました。学習が nan で止まる問題と、サンプルが飛び散る問題も直したので、最後まで動きます。";

// デモ用のプロジェクトを作り直し、フックで届いた体の判定と、それを当てはめたマップを入れる。
// 入れた判定の id を返す（呼ぶ側はそこへ移る）
export async function preparePitchDemo(): Promise<string> {
  setDemoMode(true);
  setStripOrientation("vertical");
  setStripOpen(true);

  const removed = deleteTheme(DEMO_THEME_ID);
  await Promise.all(removed.map((id) => deleteDiff(id)));
  const theme = saveTheme({ ...demoTheme, updatedAt: "" });

  const now = nowIso();
  const review: Review = {
    id: PITCH_REVIEW_ID,
    themeId: DEMO_THEME_ID,
    source: "claude_code_hook",
    purpose: PITCH_PROMPT,
    commitSha: "",
    commitMessage: "",
    earlierPrompts: PITCH_EARLIER_PROMPTS,
    observedErrors: PITCH_ERRORS,
    aiReport: PITCH_AI_REPORT,
    createdAt: now,
    findings: demoReviewFindings(MAIN_SHA),
  };
  saveHookReview(review);
  const diff = demoDiff(MAIN_SHA);
  if (diff) await saveDiff(review.id, { ...diff, sha: "", message: "", url: "" });

  // マップは取り込む前の状態のまま置く（更新まで当てはめると、判定結果の上に「マップに反映しました」が大きく出て、隠れた問題が下に押し出されるため）
  saveWorkflowMap(
    demoWorkflowMap(
      {
        themeId: DEMO_THEME_ID,
        theme: { name: theme.name, question: theme.question, method: theme.method, evaluation: theme.evaluation },
        repo: theme.repo,
      },
      now,
    ),
  );

  return review.id;
}
