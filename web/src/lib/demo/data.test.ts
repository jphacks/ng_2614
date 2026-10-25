import { describe, expect, it } from "vitest";
import {
  demoAnswerSuggestion,
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
    expect(questions).toHaveLength(2); // ピッチ向けに2つまで
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
        covered: [],
        turns: [...start, { role: "student", text: "エラーが出たから" }],
      });
      expect(res.done).toBe(false);
      expect(res.message).toContain("理由になっていません");
    });

    it("研究への影響まで言えたら、理解できたで終える", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        covered: [],
        turns: [
          ...start,
          { role: "student", text: "正規化したまま測ると、元のスケールで測る README の評価と値の意味が変わるからです" },
        ],
      });
      expect(res).toMatchObject({ done: true, understood: true });
    });

    it("「分かりません」が2回続いたら、講評して終える", () => {
      const res = demoTeacherTurn({
        theme,
        question: q,
        covered: [],
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
        covered: [],
        turns: [...start, { role: "student", text: "AIがやったので分かりません" }],
      });
      expect(res.done).toBe(false);
      expect(res.message).toContain("normalize");
    });

    it("質問には必須の観点が付き、言えた観点は積み上がる", () => {
      expect(q.viewpoints.some((v) => v.required)).toBe(true);
      const first = demoTeacherTurn({
        theme,
        question: q,
        covered: [],
        turns: [...start, { role: "student", text: "元のスケールのまま測っていないので README と違います" }],
      });
      expect(first.done).toBe(false);
      expect(first.covered).toEqual(["v2"]);
      const second = demoTeacherTurn({
        theme,
        question: q,
        covered: first.covered,
        turns: [
          ...start,
          { role: "student", text: "元のスケールのまま測っていないので README と違います" },
          { role: "teacher", text: first.message },
          { role: "student", text: "だから前の結果とそのまま比べられません" },
        ],
      });
      expect(second).toMatchObject({ done: true, understood: true, covered: ["v2", "v3"] });
    });

    it("ピッチの回答（AIがやった → 一部だけ正しい）で、一部正解の講評をして終える", () => {
      const first = demoAnswerSuggestion(q.question, 0);
      const second = demoAnswerSuggestion(q.question, 1);
      expect(first).toBe("AIがやったのでわかりません");
      expect(second).toBeDefined();
      expect(demoAnswerSuggestion(q.question, 2)).toBeUndefined();

      const reply = demoTeacherTurn({
        theme,
        question: q,
        covered: [],
        turns: [...start, { role: "student", text: first! }],
      });
      expect(reply.done).toBe(false);
      expect(reply.message).toContain("AIがやったかどうかは関係ありません");

      const res = demoTeacherTurn({
        theme,
        question: q,
        covered: reply.covered,
        turns: [
          ...start,
          { role: "student", text: first! },
          { role: "teacher", text: reply.message },
          { role: "student", text: second! },
        ],
      });
      expect(res).toMatchObject({ done: true, understood: false, covered: ["v1"] });
      expect(res.message).toContain("分かっていますね");
      expect(res.message).toContain("まだ分かっていない");
    });
  });

  it("デモ用のプロジェクトで問題を保存していなくても、正規化の質問から始める", () => {
    const questions = demoTeacherQuestions({ theme, problems: [] });
    expect(questions).toHaveLength(2);
    expect(questions[0].question).toContain("正規化");
    expect(demoAnswerSuggestion(questions[0].question, 0)).toBe("AIがやったのでわかりません");
  });

  it("ほかのプロジェクトで問題が無ければ、研究の目的について質問する", () => {
    const questions = demoTeacherQuestions({
      theme: { ...theme, name: "別の研究" },
      problems: [],
    });
    expect(questions).toHaveLength(1);
    expect(questions[0].layer).toBe("research");
  });
});
