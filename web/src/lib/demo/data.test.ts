import { describe, expect, it } from "vitest";
import {
  demoCommits,
  demoDiff,
  demoReviewFindings,
  demoTeacherFeedback,
  demoTeacherQuestions,
  demoTheme,
} from "./data";

const theme = {
  name: demoTheme.name,
  question: demoTheme.question,
  method: demoTheme.method,
  evaluation: demoTheme.evaluation,
};

describe("デモデータ", () => {
  it("すべてのコミットに差分がある", () => {
    for (const c of demoCommits) {
      expect(demoDiff(c.sha)?.files.length).toBeGreaterThan(0);
    }
  });

  it("メインのコミットは3種類の判定を含む", () => {
    const findings = demoReviewFindings(demoCommits[0].sha);
    const types = new Set(findings.map((f) => f.type));
    expect(types).toEqual(
      new Set(["on_purpose", "hidden_problem", "extra_addition"]),
    );
    expect(findings.every((f) => f.saved === false)).toBe(true);
  });

  it("保存した問題から質問を作り、キーワードで理解度を判定する", () => {
    const problems = demoReviewFindings(demoCommits[0].sha).filter(
      (f) => f.type === "hidden_problem",
    );
    const questions = demoTeacherQuestions({ theme, problems });
    expect(questions.length).toBeGreaterThan(1);
    expect(questions.some((q) => q.layer === "research")).toBe(true);
    expect(questions.some((q) => q.layer === "implementation")).toBe(true);

    const q = questions[0];
    const good = demoTeacherFeedback({
      theme,
      question: q,
      answer: "ロジスティック回帰は NaN を扱えないので落ちていた",
    });
    expect(good.understood).toBe(true);

    const bad = demoTeacherFeedback({ theme, question: q, answer: "わかりません" });
    expect(bad.understood).toBe(false);
  });

  it("問題が無くても研究の目的について質問する", () => {
    const questions = demoTeacherQuestions({ theme, problems: [] });
    expect(questions).toHaveLength(1);
    expect(questions[0].layer).toBe("research");
  });
});
