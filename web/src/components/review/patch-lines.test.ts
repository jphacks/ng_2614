import { describe, expect, it } from "vitest";
import { parsePatch } from "./patch-lines";

describe("parsePatch（F-14）", () => {
  it("元と変更後の行番号を振る", () => {
    const rows = parsePatch("@@ -1,3 +1,4 @@\n a\n-b\n+B\n+C\n c\n");
    expect(rows).toEqual([
      { kind: "gap", skipped: 0, context: "" },
      { kind: "ctx", oldNo: 1, newNo: 1, text: "a" },
      { kind: "del", oldNo: 2, text: "b" },
      { kind: "add", newNo: 2, text: "B" },
      { kind: "add", newNo: 3, text: "C" },
      { kind: "ctx", oldNo: 3, newNo: 4, text: "c" },
    ]);
  });

  it("ファイルの先頭やハンクの間で省いた行の数を出す", () => {
    const rows = parsePatch(
      "@@ -9,2 +9,3 @@ def get_betas(name):\n x\n+y\n z\n@@ -20,1 +21,1 @@ class Denoiser:\n-p\n+q\n",
    );
    const gaps = rows.filter((r) => r.kind === "gap");
    expect(gaps).toEqual([
      { kind: "gap", skipped: 8, context: "def get_betas(name):" },
      { kind: "gap", skipped: 9, context: "class Denoiser:" },
    ]);
    expect(rows.find((r) => r.kind === "add" && r.text === "q")).toMatchObject({
      newNo: 21,
    });
  });

  it("新しく作ったファイルは省いた行が無い", () => {
    const rows = parsePatch("@@ -0,0 +1,2 @@\n+a\n+b\n");
    expect(rows[0]).toEqual({ kind: "gap", skipped: 0, context: "" });
    expect(rows[2]).toEqual({ kind: "add", newNo: 2, text: "b" });
  });

  it("長さを省いた見出し（@@ -5 +5 @@）と、改行なしの印を扱う", () => {
    const rows = parsePatch(
      "@@ -5 +5 @@\n-a\n+b\n\\ No newline at end of file",
    );
    expect(rows[0]).toEqual({ kind: "gap", skipped: 4, context: "" });
    expect(rows[3]).toEqual({
      kind: "note",
      text: "\\ No newline at end of file",
    });
  });
});
