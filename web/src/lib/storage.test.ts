import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffResponse } from "./api-types";
import {
  cutObservedErrors,
  deleteTheme,
  findThemeByRepo,
  getLegacyHookDiff,
  getReview,
  getTheme,
  getWorkflowMap,
  listReviews,
  listTeacherSessions,
  saveHookReview,
  saveTeacherSession,
  saveTheme,
  saveWorkflowMap,
} from "./storage";
import type {
  ResearchTheme,
  Review,
  TeacherSession,
  WorkflowMap,
} from "./types";

// Node には localStorage が無いので、メモリ上の代わりを window に置く
function stubWindow(limit = Infinity) {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limit) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
  };
  vi.stubGlobal("window", {
    localStorage,
    dispatchEvent: () => true,
  });
}

function theme(id: string, repo: string): ResearchTheme {
  return {
    id,
    name: id,
    repo,
    question: "",
    method: "",
    evaluation: "",
    updatedAt: "",
  };
}

function diff(sha: string): DiffResponse {
  return { sha, message: "", url: "", files: [], truncated: false };
}

beforeEach(() => {
  stubWindow();
});

describe("findThemeByRepo", () => {
  it("大文字小文字と前後の空白を無視して一致する", () => {
    saveTheme(theme("a", "Owner/Repo"));
    expect(findThemeByRepo("  owner/repo ")?.id).toBe("a");
  });

  it("一致しないときと空文字は undefined", () => {
    saveTheme(theme("a", "owner/repo"));
    expect(findThemeByRepo("owner/other")).toBeUndefined();
    expect(findThemeByRepo("")).toBeUndefined();
  });

  it("複数あれば最後に更新したもの", async () => {
    saveTheme(theme("old", "owner/repo"));
    await new Promise((r) => setTimeout(r, 5));
    saveTheme(theme("new", "OWNER/repo"));
    expect(findThemeByRepo("owner/repo")?.id).toBe("new");
  });
});

describe("F-14 より前のフックの差分", () => {
  it("localStorage に残っていれば読み出せる", () => {
    window.localStorage.setItem(
      "rc.hookDiffs",
      JSON.stringify([{ reviewId: "r1", commit: diff("s1") }]),
    );
    expect(getLegacyHookDiff("r1")?.sha).toBe("s1");
    expect(getLegacyHookDiff("r2")).toBeUndefined();
  });
});

describe("エラー出力の切り詰め", () => {
  it("500文字までに切る", () => {
    const cut = cutObservedErrors([
      { tool: "Bash", input: "python a.py", output: "x".repeat(2000) },
      { tool: "Bash", input: "ls", output: "short" },
    ]);
    expect(cut[0].output).toHaveLength(500);
    expect(cut[0].input).toBe("python a.py");
    expect(cut[1].output).toBe("short");
  });

  it("saveHookReview は保存するエラー出力を切る", () => {
    const review: Review = {
      id: "rv",
      themeId: "t",
      source: "claude_code_hook",
      purpose: "p",
      commitSha: "",
      commitMessage: "",
      observedErrors: [{ tool: "Bash", input: "i", output: "y".repeat(900) }],
      createdAt: "",
      findings: [],
    };
    saveHookReview(review);
    expect(getReview("rv")?.observedErrors?.[0].output).toHaveLength(500);
  });
});

describe("deleteTheme（プロジェクトの削除）", () => {
  function review(id: string, themeId: string): Review {
    return {
      id,
      themeId,
      purpose: "p",
      commitSha: "",
      commitMessage: "",
      createdAt: "",
      findings: [],
    } as unknown as Review;
  }

  it("プロジェクトと、その判定・先生モードの記録・マップ・古い差分を消し、ほかのプロジェクトは残す", () => {
    saveTheme(theme("a", "owner/a"));
    saveTheme(theme("b", "owner/b"));
    saveHookReview(review("ra", "a"));
    saveHookReview(review("rb", "b"));
    saveTeacherSession({
      id: "sa",
      themeId: "a",
      createdAt: "",
      items: [],
    } as TeacherSession);
    saveTeacherSession({
      id: "sb",
      themeId: "b",
      createdAt: "",
      items: [],
    } as TeacherSession);
    saveWorkflowMap({ themeId: "a" } as WorkflowMap);
    saveWorkflowMap({ themeId: "b" } as WorkflowMap);
    window.localStorage.setItem(
      "rc.hookDiffs",
      JSON.stringify([
        { reviewId: "ra", commit: diff("s1") },
        { reviewId: "rb", commit: diff("s2") },
      ]),
    );

    expect(deleteTheme("a")).toEqual(["ra"]);

    expect(getTheme("a")).toBeUndefined();
    expect(listReviews("a")).toEqual([]);
    expect(listTeacherSessions("a")).toEqual([]);
    expect(getWorkflowMap("a")).toBeUndefined();
    expect(getLegacyHookDiff("ra")).toBeUndefined();

    expect(getTheme("b")?.id).toBe("b");
    expect(listReviews("b").map((r) => r.id)).toEqual(["rb"]);
    expect(listTeacherSessions("b").map((s) => s.id)).toEqual(["sb"]);
    expect(getWorkflowMap("b")?.themeId).toBe("b");
    expect(getLegacyHookDiff("rb")?.sha).toBe("s2");
  });

  it("無いプロジェクトを消しても、何も壊れない", () => {
    saveTheme(theme("a", "owner/a"));
    expect(deleteTheme("none")).toEqual([]);
    expect(getTheme("a")?.id).toBe("a");
  });
});
