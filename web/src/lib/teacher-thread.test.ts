import { describe, expect, it } from "vitest";
import type { TeacherQuestion } from "./api-types";
import { buildThread, layerLabel } from "./teacher-thread";
import type { TeacherItem, TeacherTurn, Viewpoint } from "./types";

const t = (text: string): TeacherTurn => ({ role: "teacher", text });
const s = (text: string): TeacherTurn => ({ role: "student", text });

const vps: Viewpoint[] = [
  { id: "v1", text: "観点1", required: true },
  { id: "v2", text: "観点2", required: false },
];

const questions: TeacherQuestion[] = [
  { layer: "research", question: "研究の質問", viewpoints: vps },
  { layer: "implementation", question: "実装の質問", viewpoints: vps },
];

const empty = {
  items: [] as TeacherItem[],
  currentIndex: 0,
  currentTurns: [] as TeacherTurn[],
  currentResult: null,
  currentCovered: [] as string[],
};

describe("先生モードのスレッド", () => {
  it("層の名前を返す", () => {
    expect(layerLabel("research")).toBe("研究手法");
    expect(layerLabel("implementation")).toBe("実装");
  });

  it("質問が無ければ空", () => {
    expect(buildThread({ ...empty, questions: [] })).toEqual([]);
  });

  it("1問目の途中は、区切りとやりとりだけで導入は無い", () => {
    const thread = buildThread({
      ...empty,
      questions,
      currentTurns: [t("研究の質問"), s("答え")],
    });
    expect(thread.map((e) => e.key)).toEqual(["q0-divider", "q0-t0", "q0-t1"]);
    expect(thread[0]).toMatchObject({ kind: "divider", questionNumber: 1, total: 2, layer: "research" });
    expect(thread[2]).toMatchObject({ kind: "message", role: "student", text: "答え" });
  });

  it("1問目が終わったら、最後のターンを外して講評を出す", () => {
    const thread = buildThread({
      ...empty,
      questions,
      currentTurns: [t("研究の質問"), s("答え"), t("講評")],
      currentResult: { feedback: "講評", understood: true },
      currentCovered: ["v1"],
    });
    expect(thread.map((e) => e.key)).toEqual(["q0-divider", "q0-t0", "q0-t1", "q0-closing"]);
    expect(thread[3]).toEqual({
      kind: "closing",
      key: "q0-closing",
      text: "講評",
      understood: true,
      viewpoints: vps,
      covered: ["v1"],
    });
  });

  it("2問目の途中は、1問目を items から出して導入を挟む", () => {
    const item: TeacherItem = {
      layer: "research",
      question: "研究の質問",
      answer: "答え",
      feedback: "講評1",
      understood: false,
      turns: [t("研究の質問"), s("答え"), t("講評1")],
      covered: ["v2"],
    };
    const thread = buildThread({
      ...empty,
      questions,
      items: [item],
      currentIndex: 1,
      currentTurns: [t("実装の質問")],
    });
    expect(thread.map((e) => e.key)).toEqual([
      "q0-divider",
      "q0-t0",
      "q0-t1",
      "q0-closing",
      "q1-divider",
      "q1-intro",
      "q1-t0",
    ]);
    expect(new Set(thread.map((e) => e.key)).size).toBe(thread.length);
    expect(thread[3]).toMatchObject({ kind: "closing", text: "講評1", understood: false, covered: ["v2"], viewpoints: vps });
    expect(thread[5]).toMatchObject({ kind: "message", role: "teacher", text: "次は実装について聞きます。" });
  });

  it("2問目以降の質問は無視する（今の質問より後ろは出さない）", () => {
    const thread = buildThread({ ...empty, questions, currentTurns: [t("研究の質問")] });
    expect(thread.some((e) => e.key.startsWith("q1-"))).toBe(false);
  });

  it("turns が無い古い記録は、最初の質問から出して講評を続ける", () => {
    const legacy: TeacherItem = {
      layer: "research",
      question: "研究の質問",
      answer: "答え",
      feedback: "講評1",
      understood: true,
    };
    const thread = buildThread({
      ...empty,
      questions,
      items: [legacy],
      currentIndex: 1,
      currentTurns: [t("実装の質問")],
    });
    expect(thread.slice(0, 3).map((e) => e.key)).toEqual(["q0-divider", "q0-t0", "q0-closing"]);
    expect(thread[1]).toMatchObject({ kind: "message", role: "teacher", text: "研究の質問" });
    // viewpoints / covered が無い記録は、質問の観点と空の covered で補う
    expect(thread[2]).toMatchObject({ kind: "closing", text: "講評1", viewpoints: vps, covered: [] });
  });

  it("items が欠けていても落ちない", () => {
    const thread = buildThread({ ...empty, questions, currentIndex: 1, currentTurns: [] });
    expect(thread.map((e) => e.key)).toEqual(["q0-divider", "q0-t0", "q1-divider", "q1-intro"]);
  });
});
