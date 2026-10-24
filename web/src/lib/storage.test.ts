import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffResponse } from "./api-types";
import {
  cutObservedErrors,
  findThemeByRepo,
  getLegacyHookDiff,
  getReview,
  saveHookReview,
  saveTheme,
} from "./storage";
import type { ResearchTheme, Review } from "./types";

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
