import { describe, expect, it } from "vitest";
import type { MapUpdateRequest } from "@/lib/api-types";
import type { Review } from "@/lib/types";
import {
  CLIP_SUMMARY,
  DEMO_THEME_ID,
  MAIN_SHA,
  NORMALIZE_SUMMARY,
  README_SHA,
  demoReviewFindings,
  demoTheme,
} from "./data";
import { demoMapUpdate, demoWorkflowMap } from "./workflow-map";

const NOW = "2026-10-24T09:00:00+09:00";

const theme = {
  name: demoTheme.name,
  question: demoTheme.question,
  method: demoTheme.method,
  evaluation: demoTheme.evaluation,
};

function generate() {
  return demoWorkflowMap(
    { themeId: DEMO_THEME_ID, theme, repo: demoTheme.repo },
    NOW,
  );
}

function makeReview(sha: string): Review {
  return {
    id: "review-1",
    themeId: DEMO_THEME_ID,
    purpose: "cosine スケジュールを追加して linear と比較する",
    commitSha: sha,
    commitMessage: "cosine スケジュールを追加して linear と比較",
    createdAt: NOW,
    findings: demoReviewFindings(sha),
  };
}

function makeUpdateReq(review: Review): MapUpdateRequest {
  return { theme, map: generate(), review };
}

describe("デモの作業フローマップ（取り込み前）", () => {
  it("参照がすべて存在する", () => {
    const map = generate();
    const phaseIds = new Set(map.phases.map((p) => p.id));
    const milestoneIds = new Set(map.milestones.map((m) => m.id));
    const taskIds = new Set(map.tasks.map((t) => t.id));

    expect(taskIds.size).toBe(map.tasks.length);
    for (const t of map.tasks) {
      expect(phaseIds.has(t.phaseId), t.id).toBe(true);
      if (t.parentId) expect(taskIds.has(t.parentId), t.id).toBe(true);
      if (t.milestoneId) expect(milestoneIds.has(t.milestoneId), t.id).toBe(true);
    }
    for (const l of map.links) {
      expect(taskIds.has(l.fromTaskId), l.id).toBe(true);
      expect(taskIds.has(l.toTaskId), l.id).toBe(true);
    }
  });

  it("全タスクに目的があり、不採用には理由がある", () => {
    const map = generate();
    for (const t of map.tasks) {
      expect(t.purpose.trim().length, t.id).toBeGreaterThan(0);
      if (t.status === "rejected") expect(t.rejectReason, t.id).toBeTruthy();
    }
    expect(map.tasks.filter((t) => t.status === "rejected")).toHaveLength(2);
  });

  it("5つのレーンと3つのマイルストーンがあり、マイルストーンは全レーンにまたがらない", () => {
    const map = generate();
    expect(map.phases.map((p) => p.name)).toEqual(["調査", "選定", "実装", "検証", "報告"]);
    expect(map.milestones).toHaveLength(3);
    const lanesOf = (milestoneId: string) =>
      new Set(map.tasks.filter((t) => t.milestoneId === milestoneId).map((t) => t.phaseId));
    expect(lanesOf("demo-milestone-metric").size).toBe(2);
    expect(lanesOf("demo-milestone-seminar").size).toBe(1);
    expect(lanesOf("demo-milestone-compare").size).toBe(4);
  });

  it("実装レーンにはまだコミットが無く、flow は5本ある", () => {
    const map = generate();
    const impl = map.tasks.filter((t) => t.phaseId === "demo-phase-implement");
    expect(impl).toHaveLength(1);
    expect(impl[0].status).toBe("todo");
    expect(impl[0].commitShas).toEqual([]);
    expect(map.links.filter((l) => l.kind === "flow")).toHaveLength(5);
    expect(map.rejected).toEqual([]);
    expect(map.appliedReviewIds).toEqual([]);
    expect(map.createdAt).toBe(NOW);
    expect(map.updatedAt).toBe(NOW);
  });

  it("デモ用でない研究テーマなら Error を投げる", () => {
    expect(() =>
      demoWorkflowMap({ themeId: "other", theme, repo: "a/b" }, NOW),
    ).toThrow("デモの作業フローマップは、デモ用の研究テーマにだけあります");
  });
});

describe("デモの作業フローマップの更新（取り込み後）", () => {
  it("cosine スケジュールと比較スクリプトのコミットで見せ場の変更を返す", () => {
    const review = makeReview(MAIN_SHA);
    const { ops, workspaceSha } = demoMapUpdate(makeUpdateReq(review));
    expect(workspaceSha).toBeTruthy();
    expect(ops).toHaveLength(9);

    const updates = ops.filter((o) => o.op === "update_task");
    expect(updates.map((o) => o.taskId)).toEqual([
      "demo-task-i1",
      "demo-task-r3-normalize",
      "demo-task-r3-clip",
      "demo-task-v1",
    ]);
    expect(updates[0]).toMatchObject({ status: "done", statusSource: "record" });
    expect(updates[1]).toMatchObject({ status: "doing", statusSource: "ai" });
    expect(updates[2]).toMatchObject({ status: "doing", statusSource: "ai" });
    expect(updates[3]).toMatchObject({ status: "todo", statusSource: "record" });

    const adds = ops.filter((o) => o.op === "add_task");
    expect(adds).toHaveLength(2);
    expect(adds[0]).toMatchObject({
      parentId: "demo-task-i1",
      commitShas: [MAIN_SHA],
      reviewIds: ["review-1"],
    });
    expect(adds[0].sources[0]).toMatchObject({ kind: "commit", path: MAIN_SHA });
    expect(adds[1]).toMatchObject({ flag: "unrecorded", statusRaw: "どの spec にも無い" });
    expect(adds[1].milestoneId).toBeUndefined();

    expect(ops.find((o) => o.op === "link_task")).toMatchObject({
      taskId: "demo-task-i1",
      commitShas: [MAIN_SHA],
      reviewIds: ["review-1"],
    });
  });

  it("impact のリンクは判定の id を拾い、既存のタスクにつながる", () => {
    const review = makeReview(MAIN_SHA);
    const req = makeUpdateReq(review);
    const { ops } = demoMapUpdate(req);
    const normalizeId = review.findings.find((f) => f.summary === NORMALIZE_SUMMARY)?.id;
    const clipId = review.findings.find((f) => f.summary === CLIP_SUMMARY)?.id;
    expect(normalizeId).toBeTruthy();
    expect(clipId).toBeTruthy();

    const links = ops.filter((o) => o.op === "add_link");
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      kind: "impact",
      fromTaskId: "demo-task-i1",
      toTaskId: "demo-task-s1-b2",
      findingId: normalizeId,
    });
    expect(links[1]).toMatchObject({
      kind: "impact",
      fromTaskId: "demo-task-i1",
      toTaskId: "demo-task-s1-b3",
      findingId: clipId,
    });

    // op の参照先（add_task の tempId を除く）は、マップに存在する
    const taskIds = new Set(req.map.tasks.map((t) => t.id));
    const tempIds = new Set(ops.filter((o) => o.op === "add_task").map((o) => o.tempId));
    const exists = (id: string) => taskIds.has(id) || tempIds.has(id);
    for (const o of ops) {
      if (o.op === "update_task" || o.op === "link_task") expect(exists(o.taskId)).toBe(true);
      if (o.op === "add_link") {
        expect(exists(o.fromTaskId)).toBe(true);
        expect(exists(o.toTaskId)).toBe(true);
      }
      if (o.op === "add_task") {
        expect(req.map.phases.some((p) => p.id === o.phaseId)).toBe(true);
        if (o.parentId) expect(exists(o.parentId)).toBe(true);
      }
    }
  });

  it("判定に隠れた問題が無ければ impact のリンクは出ない", () => {
    const review = makeReview(MAIN_SHA);
    review.findings = review.findings.map((f) =>
      f.type === "hidden_problem" ? { ...f, summary: "別の内容" } : f,
    );
    const { ops } = demoMapUpdate(makeUpdateReq(review));
    expect(ops.filter((o) => o.op === "add_link")).toHaveLength(0);
    expect(ops).toHaveLength(5);
  });

  it("片方の隠れた問題しか無ければ、その impact だけ出る", () => {
    const review = makeReview(MAIN_SHA);
    review.findings = review.findings.filter((f) => f.summary !== CLIP_SUMMARY);
    const { ops } = demoMapUpdate(makeUpdateReq(review));
    const links = ops.filter((o) => o.op === "add_link");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ toTaskId: "demo-task-s1-b2" });
  });

  it("ほかのコミットなら空の一覧を返す", () => {
    expect(demoMapUpdate(makeUpdateReq(makeReview(README_SHA)))).toEqual({ ops: [] });
    expect(demoMapUpdate(makeUpdateReq(makeReview("")))).toEqual({ ops: [] });
  });
});
