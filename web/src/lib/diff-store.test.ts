import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffResponse } from "./api-types";
import { deleteDiff, getDiff, saveDiff } from "./diff-store";

function diff(sha: string): DiffResponse {
  return {
    sha,
    message: "",
    url: "",
    files: [
      {
        filename: "a.py",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-x\n+y",
      },
    ],
    truncated: false,
  };
}

// F-14 より前の localStorage の差分を読むため、window.localStorage を用意する
function stubWindow(legacy: unknown[] = []) {
  const data = new Map<string, string>([
    ["rc.hookDiffs", JSON.stringify(legacy)],
  ]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    },
  });
}

beforeEach(() => {
  stubWindow();
});

describe("差分の保存（IndexedDB）", () => {
  it("保存した差分を判定の id で読み出せる", async () => {
    expect(await saveDiff("r1", diff("s1"))).toBe(true);
    expect((await getDiff("r1"))?.sha).toBe("s1");
    expect((await getDiff("r1"))?.files[0].patch).toContain("+y");
  });

  it("件数の上限なく残る", async () => {
    for (let i = 0; i < 30; i++) await saveDiff(`many${i}`, diff(`m${i}`));
    expect((await getDiff("many0"))?.sha).toBe("m0");
    expect((await getDiff("many29"))?.sha).toBe("m29");
  });

  it("同じ id で保存し直すと上書きする", async () => {
    await saveDiff("r2", diff("old"));
    await saveDiff("r2", diff("new"));
    expect((await getDiff("r2"))?.sha).toBe("new");
  });

  it("消せる", async () => {
    await saveDiff("r3", diff("s3"));
    await deleteDiff("r3");
    expect(await getDiff("r3")).toBeUndefined();
  });

  it("IndexedDB に無ければ、以前 localStorage に残したフックの差分を返す", async () => {
    stubWindow([{ reviewId: "legacy", commit: diff("from-local") }]);
    expect((await getDiff("legacy"))?.sha).toBe("from-local");
  });
});
