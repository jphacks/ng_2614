import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffResponse } from "./api-types";
import {
  cutObservedErrors,
  findThemeByRepo,
  getHookDiff,
  getReview,
  saveHookDiff,
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

describe("フックの差分の保存", () => {
  it("直近5件だけ残し、古いものは消える", () => {
    for (let i = 1; i <= 7; i++) saveHookDiff(`r${i}`, diff(`s${i}`));
    expect(getHookDiff("r1")).toBeUndefined();
    expect(getHookDiff("r2")).toBeUndefined();
    for (let i = 3; i <= 7; i++) {
      expect(getHookDiff(`r${i}`)?.sha).toBe(`s${i}`);
    }
  });

  it("同じ判定の差分を保存し直しても件数は増えない", () => {
    for (let i = 1; i <= 5; i++) saveHookDiff(`r${i}`, diff(`s${i}`));
    saveHookDiff("r1", diff("again"));
    expect(getHookDiff("r1")?.sha).toBe("again");
    expect(getHookDiff("r2")?.sha).toBe("s2");
  });

  it("容量があふれても例外を出さない", () => {
    stubWindow(10);
    expect(() => saveHookDiff("r1", diff("s1"))).not.toThrow();
    expect(getHookDiff("r1")).toBeUndefined();
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

  it("saveHookReview は保存するエラー出力を切り、差分も残す", () => {
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
    saveHookReview(review, diff("d"));
    expect(getReview("rv")?.observedErrors?.[0].output).toHaveLength(500);
    expect(getHookDiff("rv")?.sha).toBe("d");
  });
});
