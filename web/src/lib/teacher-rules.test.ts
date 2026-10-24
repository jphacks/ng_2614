import { describe, expect, it } from "vitest";
import {
  countStudentTurns,
  dontKnowStreak,
  isDontKnow,
  mustFinish,
} from "./teacher-rules";
import type { TeacherTurn } from "./types";

const t = (text: string): TeacherTurn => ({ role: "teacher", text });
const s = (text: string): TeacherTurn => ({ role: "student", text });

describe("先生モードの終える条件", () => {
  it("「分かりません」を見分ける", () => {
    expect(isDontKnow("分かりません")).toBe(true);
    expect(isDontKnow("AIがやったのでわからない")).toBe(true);
    expect(isDontKnow("NaN が原因です")).toBe(false);
  });

  it("続けて「分かりません」と答えた回数を数える", () => {
    expect(dontKnowStreak([t("q"), s("分かりません"), t("q2"), s("分かりません")])).toBe(2);
    expect(dontKnowStreak([t("q"), s("分かりません"), t("q2"), s("NaN です")])).toBe(0);
  });

  it("3回答えたか、「分かりません」が2回続いたら終える", () => {
    expect(mustFinish([t("q"), s("a")])).toBe(false);
    expect(mustFinish([t("q"), s("a"), t("q2"), s("b"), t("q3"), s("c")])).toBe(true);
    expect(mustFinish([t("q"), s("分かりません"), t("q2"), s("知りません")])).toBe(true);
    expect(countStudentTurns([t("q"), s("a"), t("q2"), s("b")])).toBe(2);
  });
});
