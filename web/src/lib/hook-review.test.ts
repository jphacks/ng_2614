import { describe, expect, it } from "vitest";
import {
  buildHookReviewRequest,
  hookPurpose,
  NO_PROMPT_TEXT,
} from "./hook-review";

describe("hookPurpose", () => {
  it("今回の依頼文があればそれを使う", () => {
    expect(hookPurpose("今回", ["前"])).toBe("今回");
  });

  it("空なら、それまでの最後の依頼文", () => {
    expect(hookPurpose("", ["最初", "直前"])).toBe("直前");
    expect(hookPurpose("  \n", ["最初", ""])).toBe("最初");
  });

  it("どちらも無ければ定型文", () => {
    expect(hookPurpose("", [])).toBe(NO_PROMPT_TEXT);
  });
});

describe("buildHookReviewRequest", () => {
  it("研究テーマから判定に必要な項目だけを渡す", () => {
    const req = buildHookReviewRequest(
      { name: "n", question: "q", method: "m", evaluation: "e" },
      "目的",
      { sha: "", message: "", url: "", files: [], truncated: false },
      {
        earlierPrompts: ["a"],
        observedErrors: [],
        generatedFiles: ["x.csv"],
        headMoved: true,
      },
    );
    expect(req.theme).toEqual({
      name: "n",
      question: "q",
      method: "m",
      evaluation: "e",
    });
    expect(req.purpose).toBe("目的");
    expect(req.generatedFiles).toEqual(["x.csv"]);
    expect(req.headMoved).toBe(true);
  });
});
