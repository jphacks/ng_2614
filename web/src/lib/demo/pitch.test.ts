import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStripOpen, getStripOrientation } from "@/lib/map/prefs";
import { getReview, getTeacherPersona, getWorkflowMap, listReviews, saveReview, saveTheme } from "@/lib/storage";
import { DEMO_TEACHER_IMAGE, DEMO_THEME_ID, demoTheme } from "./data";
import { isDemoMode } from "./mode";
import { PITCH_REVIEW_ID, deliverPitchReview, preparePitchDemo } from "./pitch";

// Node には localStorage が無いので、メモリ上の代わりを window に置く
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
    dispatchEvent: () => true,
  });
});

describe("ピッチ用の入口", () => {
  it("デモモードと縦の帯を入れ、プロジェクトとマップを用意する（判定はまだ入れない）", async () => {
    const id = await preparePitchDemo();
    expect(id).toBe(DEMO_THEME_ID);
    expect(isDemoMode()).toBe(true);
    expect(getStripOrientation()).toBe("vertical");
    expect(getStripOpen()).toBe(true);
    expect(listReviews(DEMO_THEME_ID)).toEqual([]);
    expect(getWorkflowMap(DEMO_THEME_ID)?.tasks.length).toBeGreaterThan(0);
    expect(getTeacherPersona(DEMO_THEME_ID)).toMatchObject({ name: "先生", image: DEMO_TEACHER_IMAGE });
  });

  it("届く演出のときに、フックで届いた体の判定を未確認で入れる", async () => {
    await preparePitchDemo();
    const review = await deliverPitchReview();
    expect(getReview(PITCH_REVIEW_ID)).toEqual(review);
    expect(review.source).toBe("claude_code_hook");
    expect(review.unopened).toBe(true);
    expect(review.findings.some((f) => f.type === "hidden_problem")).toBe(true);
    expect(review.findings.some((f) => f.saved)).toBe(false);
  });

  it("前のリハーサルの判定を消し、何度開いても同じ状態から始める", async () => {
    saveTheme({ ...demoTheme, updatedAt: "" });
    saveReview({
      id: "old",
      themeId: DEMO_THEME_ID,
      purpose: "前のリハーサル",
      commitSha: "x",
      commitMessage: "x",
      createdAt: "2026-10-25T00:00:00Z",
      findings: [],
    });
    await preparePitchDemo();
    await deliverPitchReview();
    await preparePitchDemo();
    await deliverPitchReview();
    expect(listReviews(DEMO_THEME_ID).map((r) => r.id)).toEqual([PITCH_REVIEW_ID]);
  });
});
