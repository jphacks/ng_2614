import { describe, expect, it } from "vitest";
import { MAX_DIFF_FILES, MAX_PATCH_CHARS_PER_FILE } from "../github";
import { diffToFiles, parseUnifiedDiff } from "./diff";

const MODIFIED = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 line1
-line2
+line2 changed
+line3 added
 line4
`;

const ADDED = `diff --git a/new.txt b/new.txt
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+hello
+world
`;

const REMOVED = `diff --git a/old.txt b/old.txt
deleted file mode 100644
index 4444444..0000000
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-bye
-world
`;

const RENAMED = `diff --git a/before.ts b/after.ts
similarity index 80%
rename from before.ts
rename to after.ts
index 5555555..6666666 100644
--- a/before.ts
+++ b/after.ts
@@ -1 +1 @@
-const a = 1;
+const a = 2;
`;

const RENAMED_PURE = `diff --git a/x.ts b/dir/y.ts
similarity index 100%
rename from x.ts
rename to dir/y.ts
`;

const BINARY = `diff --git a/img.bin b/img.bin
index 7777777..8888888 100644
Binary files a/img.bin and b/img.bin differ
`;

describe("parseUnifiedDiff", () => {
  it("空の入力は空配列", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("  \n")).toEqual([]);
    expect(parseUnifiedDiff("diff の形ではない文字列")).toEqual([]);
  });

  it("変更されたファイル（modified）", () => {
    const [file] = parseUnifiedDiff(MODIFIED);
    expect(file.filename).toBe("src/a.ts");
    expect(file.status).toBe("modified");
    expect(file.additions).toBe(2);
    expect(file.deletions).toBe(1);
    expect(file.patch?.startsWith("@@ -1,3 +1,4 @@")).toBe(true);
    expect(file.patch?.endsWith(" line4")).toBe(true);
    expect(file.patch).not.toContain("+++");
  });

  it("追加されたファイル（added）", () => {
    const [file] = parseUnifiedDiff(ADDED);
    expect(file).toMatchObject({
      filename: "new.txt",
      status: "added",
      additions: 2,
      deletions: 0,
    });
  });

  it("削除されたファイル（removed）", () => {
    const [file] = parseUnifiedDiff(REMOVED);
    expect(file).toMatchObject({
      filename: "old.txt",
      status: "removed",
      additions: 0,
      deletions: 2,
    });
  });

  it("名前の変更（renamed）は新しいパスを使う", () => {
    const [file] = parseUnifiedDiff(RENAMED);
    expect(file).toMatchObject({
      filename: "after.ts",
      status: "renamed",
      additions: 1,
      deletions: 1,
    });
    const [pure] = parseUnifiedDiff(RENAMED_PURE);
    expect(pure).toMatchObject({
      filename: "dir/y.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
    });
    expect(pure.patch).toBeUndefined();
  });

  it("バイナリには patch が無い", () => {
    const [file] = parseUnifiedDiff(BINARY);
    expect(file.filename).toBe("img.bin");
    expect(file.status).toBe("modified");
    expect(file.patch).toBeUndefined();
  });

  it("複数のファイルを順に分ける", () => {
    const files = parseUnifiedDiff(
      MODIFIED + ADDED + BINARY + REMOVED + RENAMED,
    );
    expect(files.map((f) => [f.filename, f.status])).toEqual([
      ["src/a.ts", "modified"],
      ["new.txt", "added"],
      ["img.bin", "modified"],
      ["old.txt", "removed"],
      ["after.ts", "renamed"],
    ]);
    // 前のファイルの patch に次のファイルの行が混ざらない
    expect(files[0].patch).not.toContain("new.txt");
  });

  it("ハンクの中の '---' '+++' で始まる行も数える", () => {
    const text = `diff --git a/a.md b/a.md
index 1..2 100644
--- a/a.md
+++ b/a.md
@@ -1,2 +1,2 @@
--- removed line starting with dashes
+++ added line starting with pluses
`;
    const [file] = parseUnifiedDiff(text);
    expect(file.additions).toBe(1);
    expect(file.deletions).toBe(1);
  });

  it("'\\ No newline at end of file' は数えない", () => {
    const text = `diff --git a/a b/a
--- a/a
+++ b/a
@@ -1 +1 @@
-x
\\ No newline at end of file
+y
\\ No newline at end of file
`;
    const [file] = parseUnifiedDiff(text);
    expect(file.additions).toBe(1);
    expect(file.deletions).toBe(1);
  });

  it("空白を含むパス", () => {
    const text = `diff --git a/my dir/a b.txt b/my dir/a b.txt
index 1..2 100644
--- a/my dir/a b.txt
+++ b/my dir/a b.txt
@@ -1 +1 @@
-x
+y
`;
    expect(parseUnifiedDiff(text)[0].filename).toBe("my dir/a b.txt");
  });

  it('引用符で囲まれたパス（"a/..."）と 8 進数のエスケープ', () => {
    const text = `diff --git "a/\\343\\203\\206\\343\\202\\271\\343\\203\\210.txt" "b/\\343\\203\\206\\343\\202\\271\\343\\203\\210.txt"
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ "b/\\343\\203\\206\\343\\202\\271\\343\\203\\210.txt"
@@ -0,0 +1 @@
+x
`;
    const [file] = parseUnifiedDiff(text);
    expect(file.filename).toBe("テスト.txt");
    expect(file.status).toBe("added");
  });

  it('引用符で囲まれたパス（"\\t" と "\\"" のエスケープ、差分の本文なし）', () => {
    const text = `diff --git "a/tab\\tq\\"x" "b/tab\\tq\\"x"
old mode 100644
new mode 100755
`;
    const [file] = parseUnifiedDiff(text);
    expect(file.filename).toBe('tab\tq"x');
    expect(file.patch).toBeUndefined();
  });

  it("CRLF の改行でも読める", () => {
    const [file] = parseUnifiedDiff(MODIFIED.replace(/\n/g, "\r\n"));
    expect(file.filename).toBe("src/a.ts");
    expect(file.additions).toBe(2);
  });
});

describe("diffToFiles", () => {
  it("上限の範囲内なら truncated は false", () => {
    const { files, truncated } = diffToFiles(MODIFIED + ADDED);
    expect(files).toHaveLength(2);
    expect(truncated).toBe(false);
  });

  it("ロックファイルの patch を落とし、truncated にする", () => {
    const text = `diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1 +1 @@
-a
+b
`;
    const { files, truncated } = diffToFiles(text);
    expect(files[0].patch).toBeUndefined();
    expect(files[0].additions).toBe(1);
    expect(truncated).toBe(true);
  });

  it("大きな patch とファイル数に上限をかける", () => {
    const big = `diff --git a/big.txt b/big.txt
--- a/big.txt
+++ b/big.txt
@@ -0,0 +1 @@
+${"x".repeat(MAX_PATCH_CHARS_PER_FILE + 10)}
`;
    const { files, truncated } = diffToFiles(big);
    expect(files[0].patch).toHaveLength(MAX_PATCH_CHARS_PER_FILE);
    expect(truncated).toBe(true);

    const many = Array.from(
      { length: MAX_DIFF_FILES + 3 },
      (_, i) => `diff --git a/f${i}.txt b/f${i}.txt
new file mode 100644
--- /dev/null
+++ b/f${i}.txt
@@ -0,0 +1 @@
+x
`,
    ).join("");
    const limited = diffToFiles(many);
    expect(limited.files).toHaveLength(MAX_DIFF_FILES);
    expect(limited.truncated).toBe(true);
  });

  it("空なら files は空", () => {
    expect(diffToFiles("")).toEqual({ files: [], truncated: false });
  });
});
