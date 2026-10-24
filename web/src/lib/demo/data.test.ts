import { describe, expect, it } from "vitest";
import {
  demoCommits,
  demoDiff,
  demoReviewFindings,
  demoTeacherQuestions,
  demoTeacherTurn,
  demoTheme,
} from "./data";
import type { TeacherTurn } from "@/lib/types";

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

  it("保存した問題から、実装と研究手法の両方の質問を作る", () => {
    const problems = demoReviewFindings(demoCommits[0].sha).filter(
      (f) => f.type === "hidden_problem",
    );
    const questions = demoTeacherQuestions({ theme, problems });
    expect(questions.length).toBeGreaterThan(1);
    expect(questions.some((q) => q.layer === "research")).toBe(true);
    expect(questions.some((q) => q.layer === "implementation")).toBe(true);
  });

  describe("問い返し", () => {
    const problems = demoReviewFindings(demoCommits[0].sha).filter(
      (f) => f.type === "hidden_problem",
    );
    const q = demoTeacherQuestions({ theme, problems })[0];
    const start: TeacherTurn[] = [{ role: "teacher", text: q.question }];

    it("浅い答えには、答えを言わずに問い返す", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        turns: [...start, { role: "student", text: "エラーが出たから" }],
      });
      expect(res.done).toBe(false);
      expect(res.message).toContain("理由になっていません");
    });

    it("研究への影響まで言えたら、理解できたで終える", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        turns: [
          ...start,
          { role: "student", text: "除外で件数が減り、データに偏りが出て比較の条件が変わるからです" },
        ],
      });
      expect(res).toMatchObject({ done: true, understood: true });
    });

    it("「分かりません」が2回続いたら、講評して終える", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        turns: [
          ...start,
          { role: "student", text: "分かりません" },
          { role: "teacher", text: "問い返し" },
          { role: "student", text: "分かりません" },
        ],
      });
      expect(res).toMatchObject({ done: true, understood: false });
      expect(res.message).toContain("ゼミまでに");
    });

    it("「AIがやった」には、差分の箇所を挙げて問い返す", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        turns: [...start, { role: "student", text: "AIがやったので分かりません" }],
      });
      expect(res.done).toBe(false);
      expect(res.message).toContain("dropna");
    });
  });

  it("問題が無くても研究の目的について質問する", () => {
    const questions = demoTeacherQuestions({ theme, problems: [] });
    expect(questions).toHaveLength(1);
    expect(questions[0].layer).toBe("research");
  });
});
