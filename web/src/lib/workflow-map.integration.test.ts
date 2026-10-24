// 作業フローマップ（F-15）のデモの通し：デモのマップに、デモの取り込みの変更を当てはめる（場面1 → 場面3）。

import { describe, expect, it } from "vitest";
import {
  DEMO_THEME_ID,
  MAIN_SHA,
  demoReviewFindings,
  demoTheme,
} from "./demo/data";
import { demoMapUpdate, demoWorkflowMap } from "./demo/workflow-map";
import { applyMapOps, undoLastUpdate } from "./map/apply";
import { deleteTask, editTaskText } from "./map/edit";
import { effectiveStatus, purposeChain } from "./map/view";
import type { Review, WorkflowMap } from "./types";

const NOW = "2026-10-24T15:00:00.000Z";
const LATER = "2026-10-24T15:05:00.000Z";

const purpose = {
  name: demoTheme.name,
  question: demoTheme.question,
  method: demoTheme.method,
  evaluation: demoTheme.evaluation,
};

function makeMap(): WorkflowMap {
  return demoWorkflowMap(
    { themeId: DEMO_THEME_ID, theme: purpose, repo: demoTheme.repo },
    NOW,
  );
}

function makeReview(): Review {
  return {
    id: "review-1",
    themeId: DEMO_THEME_ID,
    source: "commit",
    purpose: "cosine スケジュールを追加して linear と比較する",
    commitSha: MAIN_SHA,
    commitMessage: "cosine スケジュールを追加して linear と比較",
    createdAt: NOW,
    findings: demoReviewFindings(MAIN_SHA),
  };
}

function byTitle(map: WorkflowMap, title: string) {
  const task = map.tasks.find((t) => t.title === title);
  if (!task) throw new Error(`タスクが無い：${title}`);
  return task;
}

describe("デモの作業フローマップの自動更新", () => {
  it("取り込みの変更がすべて当てはまり、見せ場の変化が起きる", () => {
    const map = makeMap();
    const review = makeReview();
    const { ops } = demoMapUpdate({ theme: purpose, map, review });
    const result = applyMapOps(map, ops, review.id, LATER);

    expect(result.skipped).toEqual([]);
    expect(result.applied).toHaveLength(ops.length);

    const next = result.map;
    const script = next.tasks.find((t) => t.id === "demo-task-i1")!;
    expect(script.status).toBe("done");
    expect(script.commitShas).toContain(MAIN_SHA);
    expect(script.reviewIds).toContain(review.id);

    // 隠れた問題から選定レーンの spec へ、逆向きの矢印が2本
    const impacts = next.links.filter((l) => l.kind === "impact");
    expect(impacts.map((l) => l.toTaskId).sort()).toEqual([
      "demo-task-s1-b2",
      "demo-task-s1-b3",
    ]);

    // 記録のない実装が増える
    expect(next.tasks.some((t) => t.flag === "unrecorded")).toBe(true);

    expect(next.appliedReviewIds).toContain(review.id);
    expect(next.lastUpdate?.reviewId).toBe(review.id);
    expect(next.previous).toBeDefined();
  });

  it("取り消すと取り込み前に戻り、同じ判定では再び更新しない", () => {
    const map = makeMap();
    const review = makeReview();
    const { ops } = demoMapUpdate({ theme: purpose, map, review });
    const updated = applyMapOps(map, ops, review.id, LATER).map;
    const undone = undoLastUpdate(updated)!;

    expect(undone.tasks).toEqual(map.tasks);
    expect(undone.links).toEqual(map.links);
    expect(undone.appliedReviewIds).toContain(review.id);
  });

  it("人が直したタスクの文言は、自動更新で上書きされない", () => {
    const review = makeReview();
    const edited = editTaskText(
      makeMap(),
      "demo-task-r3-normalize",
      { title: "データの正規化（自分で確認する）" },
      NOW,
    );
    const { ops } = demoMapUpdate({ theme: purpose, map: edited, review });
    const next = applyMapOps(edited, ops, review.id, LATER).map;

    const normalize = next.tasks.find((t) => t.id === "demo-task-r3-normalize")!;
    expect(normalize.title).toBe("データの正規化（自分で確認する）");
    expect(normalize.status).toBe("todo"); // edited は状態も上書きしない
  });

  it("人が消したものと同じタイトルの提案は足されない", () => {
    const review = makeReview();
    const base = makeMap();
    const { ops } = demoMapUpdate({ theme: purpose, map: base, review });
    const first = applyMapOps(base, ops, review.id, LATER).map;
    const unrecorded = first.tasks.find((t) => t.flag === "unrecorded")!;

    // 消したあと、同じ変更がもう一度来ても足さない
    const deleted = deleteTask(first, unrecorded.id, "--quick は使わないと決めた", LATER);
    const again = applyMapOps(deleted, ops, "review-2", LATER);
    expect(again.map.tasks.some((t) => t.title === unrecorded.title)).toBe(false);
  });

  it("検証のタスクから研究の問いの側へ、目的のつながりをたどれる", () => {
    const map = makeMap();
    const chain = purposeChain(map, "demo-task-v1").map((t) => t.id);
    expect(chain.at(-1)).toBe("demo-task-v1");
    expect(chain).toContain("demo-task-i1");
    expect(chain).toContain("demo-task-s1");
    expect(chain[0]).toBe("demo-task-r1");
  });

  it("取り込み前の比較実験の spec は、サブタスクから完了になる", () => {
    const map = makeMap();
    expect(effectiveStatus(map, byTitle(map, "比較実験の spec"))).toBe("done");
  });
});
