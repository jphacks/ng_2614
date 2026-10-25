// unified diff の patch を、行番号付きの行に分ける（F-14）。表示（DiffView）で使う

export type PatchRow =
  | { kind: "gap"; skipped: number; context: string } // 変更のない行を省いたところ（ハンクの見出し）
  | {
      kind: "add" | "del" | "ctx";
      oldNo?: number;
      newNo?: number;
      text: string;
    }
  | { kind: "note"; text: string }; // "\ No newline at end of file" など

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export function parsePatch(patch: string): PatchRow[] {
  const rows: PatchRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  // 前のハンクが終わった次の行（元のファイルでの行番号）。最初は 1 行目
  let nextOld = 1;

  const lines = patch.split("\n");
  if (lines[lines.length - 1] === "") lines.pop(); // 末尾の改行

  for (const line of lines) {
    const m = HUNK.exec(line);
    if (m) {
      const oldStart = Number(m[1]);
      const oldLen = m[2] === undefined ? 1 : Number(m[2]);
      const newStart = Number(m[3]);
      // 新しく作ったファイル（-0,0）は、省いた行が無い
      const skipped =
        oldLen === 0 && oldStart === 0 ? 0 : Math.max(0, oldStart - nextOld);
      rows.push({ kind: "gap", skipped, context: m[5].trim() });
      oldNo = oldStart;
      newNo = newStart;
      nextOld = oldStart + oldLen;
      continue;
    }
    if (line.startsWith("+")) {
      rows.push({ kind: "add", newNo: newNo++, text: line.slice(1) });
    } else if (line.startsWith("-")) {
      rows.push({ kind: "del", oldNo: oldNo++, text: line.slice(1) });
    } else if (line.startsWith("\\")) {
      rows.push({ kind: "note", text: line });
    } else {
      // 先頭が空白の行（変更なし）。途中で切り詰められた patch の行もここに来る
      rows.push({
        kind: "ctx",
        oldNo: oldNo++,
        newNo: newNo++,
        text: line.slice(1),
      });
    }
  }
  return rows;
}
