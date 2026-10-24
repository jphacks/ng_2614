// フックが送ってくる `git diff` の出力（unified diff）を、ファイルごとに分ける。
// 分けた結果は GitHub の diff と同じ形（DiffFile）に揃え、サイズの上限をかける。

import type { DiffFile } from "../api-types";
import { limitDiffFiles } from "../github";

// limitDiffFiles に渡せる形（GitHub API のファイルと同じ項目）
export type RawDiffFile = {
  filename: string;
  status: "added" | "removed" | "renamed" | "modified";
  additions: number;
  deletions: number;
  patch?: string;
};

const HEADER_PREFIX = "diff --git ";

// git は、特殊な文字を含むパスを "..." で囲み、C 言語風にエスケープする
// （日本語は \343\201\202 のような 8 進数のバイト列になる）
function unquoteGitPath(token: string): string {
  if (token.length < 2 || !token.startsWith('"') || !token.endsWith('"')) {
    return token;
  }
  const inner = token.slice(1, -1);
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  const simple: Record<string, number> = {
    n: 10,
    t: 9,
    r: 13,
    a: 7,
    b: 8,
    f: 12,
    v: 11,
    '"': 34,
    "\\": 92,
  };
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      bytes.push(...encoder.encode(ch));
      continue;
    }
    const next = inner[i + 1];
    if (next !== undefined && /[0-7]/.test(next)) {
      const octal = /^[0-7]{1,3}/.exec(inner.slice(i + 1, i + 4))![0];
      bytes.push(parseInt(octal, 8) & 0xff);
      i += octal.length;
    } else if (next !== undefined && next in simple) {
      bytes.push(simple[next]);
      i += 1;
    } else {
      bytes.push(...encoder.encode(ch));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// 先頭にある "..." で囲まれた 1 つ分を取り出す
function takeQuoted(text: string): { token: string; rest: string } | null {
  if (!text.startsWith('"')) return null;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === "\\") {
      i += 1;
    } else if (text[i] === '"') {
      return { token: text.slice(0, i + 1), rest: text.slice(i + 1) };
    }
  }
  return null;
}

function stripPrefix(path: string, prefix: "a/" | "b/"): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

// "diff --git a/X b/Y" の行から、新しい側のパス（Y）を求める
function pathFromHeader(line: string): string {
  const rest = line.slice(HEADER_PREFIX.length);

  // どちらかが "..." で囲まれている
  if (rest.startsWith('"')) {
    const first = takeQuoted(rest);
    if (first) {
      const afterFirst = first.rest.replace(/^ /, "");
      const second = takeQuoted(afterFirst);
      const newToken = second ? second.token : afterFirst;
      return stripPrefix(unquoteGitPath(newToken), "b/");
    }
  }
  const quotedNew = rest.indexOf(' "b/');
  if (quotedNew !== -1) {
    return stripPrefix(unquoteGitPath(rest.slice(quotedNew + 1)), "b/");
  }

  // 囲まれていない：a/X と b/Y が同じパスなら、ちょうど半分に割れる位置を探す
  for (let i = rest.indexOf(" b/"); i !== -1; i = rest.indexOf(" b/", i + 1)) {
    const left = rest.slice(0, i);
    const right = rest.slice(i + 1);
    if (left.startsWith("a/") && left.slice(2) === right.slice(2)) {
      return right.slice(2);
    }
  }
  // 名前の変更などで a/X と b/Y が違うときは、最初の " b/" で割る
  const idx = rest.indexOf(" b/");
  if (idx !== -1) return rest.slice(idx + 3);
  return rest;
}

// "--- a/X" / "+++ b/Y" / "rename to Y" の値からパスを取り出す。/dev/null は null
function pathFromLine(value: string, prefix: "a/" | "b/"): string | null {
  // git は、空白を含むパスの末尾にタブを付けることがある
  const trimmed = value.replace(/\t.*$/, "");
  if (trimmed === "/dev/null") return null;
  return stripPrefix(unquoteGitPath(trimmed), prefix);
}

function parseSection(lines: string[]): RawDiffFile {
  let filename = pathFromHeader(lines[0]);
  let status: RawDiffFile["status"] = "modified";
  let renameTo: string | null = null;
  let oldPath: string | null = null;
  let newPath: string | null = null;
  let isBinary = false;
  let additions = 0;
  let deletions = 0;
  let firstHunk = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (firstHunk !== -1) {
      // ハンクの中。ヘッダー（---/+++）はここには出ないので、先頭の文字だけで数える
      if (line.startsWith("+")) additions++;
      else if (line.startsWith("-")) deletions++;
      continue;
    }
    if (line.startsWith("@@")) {
      firstHunk = i;
    } else if (line.startsWith("new file mode")) {
      status = "added";
    } else if (line.startsWith("deleted file mode")) {
      status = "removed";
    } else if (line.startsWith("rename to ")) {
      renameTo = pathFromLine(line.slice("rename to ".length), "b/");
      if (status === "modified") status = "renamed";
    } else if (line.startsWith("--- ")) {
      oldPath = pathFromLine(line.slice(4), "a/");
    } else if (line.startsWith("+++ ")) {
      newPath = pathFromLine(line.slice(4), "b/");
    } else if (
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      isBinary = true;
      break;
    }
  }

  if (renameTo) filename = renameTo;
  else if (newPath) filename = newPath;
  else if (status === "removed" && oldPath) filename = oldPath;

  const file: RawDiffFile = { filename, status, additions, deletions };
  if (!isBinary && firstHunk !== -1) {
    file.patch = lines.slice(firstHunk).join("\n").replace(/\n+$/, "");
  }
  return file;
}

// `git diff` の出力を、ファイルごとの {filename, status, additions, deletions, patch?} に分ける
export function parseUnifiedDiff(text: string): RawDiffFile[] {
  if (!text.trim()) return [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const sections: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith(HEADER_PREFIX)) {
      current = [line];
      sections.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return sections.map(parseSection);
}

// 分けたうえで、ファイル数・patch の大きさに上限をかける（GitHub の差分と同じ）
export function diffToFiles(text: string): {
  files: DiffFile[];
  truncated: boolean;
} {
  return limitDiffFiles(parseUnifiedDiff(text));
}
