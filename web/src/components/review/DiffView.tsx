// コードの差分（unified diff の patch）の表示（F-14）。追加は緑、削除は赤で示し、行番号を付ける。
// 隠れた問題の差分（pen）では、変更した行の左に赤ペンの線を引く（設計書「画面の見た目」）

import type { DiffFile } from "@/lib/api-types";
import { parsePatch } from "./patch-lines";

const STATUS_LABEL: Record<string, string> = {
  added: "追加",
  removed: "削除",
  modified: "変更",
  renamed: "名前の変更",
};

const ROW_CLASS = {
  add: "bg-add text-add-ink",
  del: "bg-del text-del-ink",
  ctx: "text-ink-2",
} as const;

const NUM_CLASS = {
  add: "text-add-ink/70",
  del: "text-del-ink/70",
  ctx: "text-ink-3",
} as const;

const MARK = { add: "+", del: "-", ctx: " " } as const;

// 行番号（元・変更後）と、変更のない行を省いたところの印を付けて出す
export function PatchView({ patch, pen = false }: { patch: string; pen?: boolean }) {
  const rows = parsePatch(patch);
  return (
    <div className="overflow-x-auto border border-hair bg-paper font-mono text-xs leading-5">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, i) => {
            if (row.kind === "gap") {
              // 先頭のハンクで省いた行も見出しも無ければ、何も出さない
              if (row.skipped === 0 && !row.context && i === 0) return null;
              return (
                <tr key={i} className="bg-paper-2 text-ink-3">
                  <td colSpan={4} className="px-3 py-0.5 font-sans">
                    {row.skipped > 0 ? `⋯ 変更のない ${row.skipped} 行` : "⋯"}
                    {row.context && (
                      <span className="ml-2 font-mono text-ink-3">
                        {row.context}
                      </span>
                    )}
                  </td>
                </tr>
              );
            }
            if (row.kind === "note") {
              return (
                <tr key={i} className="text-ink-3">
                  <td colSpan={4} className="px-3">
                    {row.text}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={i} className={ROW_CLASS[row.kind]}>
                <td
                  className={`w-10 select-none border-l-2 border-r border-r-hair px-2 text-right tabular-nums ${NUM_CLASS[row.kind]} ${
                    pen && row.kind !== "ctx" ? "border-l-pen" : "border-l-transparent"
                  }`}
                >
                  {row.oldNo ?? ""}
                </td>
                <td
                  className={`w-10 select-none border-r border-hair px-2 text-right tabular-nums ${NUM_CLASS[row.kind]}`}
                >
                  {row.newNo ?? ""}
                </td>
                <td className="w-4 select-none pl-2 text-center">
                  {MARK[row.kind]}
                </td>
                <td className="whitespace-pre pr-3">{row.text || " "}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FileDiff({
  file,
  defaultOpen = false,
  pen = false,
}: {
  file: DiffFile;
  defaultOpen?: boolean;
  pen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group/file border border-hair"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 bg-paper-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-ink-3 group-open/file:rotate-90">▶</span>
        <code className="font-mono text-ink">{file.filename}</code>
        <span className="text-xs text-ink-3">
          {STATUS_LABEL[file.status] ?? file.status}
        </span>
        <span className="font-mono text-xs text-add-ink">+{file.additions}</span>
        <span className="font-mono text-xs text-del-ink">-{file.deletions}</span>
      </summary>
      <div className="p-2">
        {file.patch ? (
          <PatchView patch={file.patch} pen={pen} />
        ) : (
          <p className="px-1 text-xs text-ink-3">
            差分の中身はありません（バイナリや大きすぎるファイル、名前の変更だけなど）。
          </p>
        )}
      </div>
    </details>
  );
}

export function FileDiffList({
  files,
  openAll = false,
  pen = false,
}: {
  files: DiffFile[];
  openAll?: boolean;
  pen?: boolean;
}) {
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <FileDiff key={f.filename} file={f} defaultOpen={openAll} pen={pen} />
      ))}
    </div>
  );
}

// 判定の各項目に、関係するファイルの差分を開いて見られるようにする
export function FindingDiffs({ files, pen = false }: { files: DiffFile[]; pen?: boolean }) {
  if (files.length === 0) return null;
  return (
    <details className="group/finding">
      <summary className="link cursor-pointer list-none text-xs font-medium [&::-webkit-details-marker]:hidden">
        <span className="inline-block group-open/finding:rotate-90">▶</span>{" "}
        コードの差分を見る（{files.length} ファイル）
      </summary>
      <div className="mt-2">
        {/* 1ファイルだけなら、開いたらすぐ中身が見えるようにする */}
        <FileDiffList files={files} openAll={files.length === 1} pen={pen} />
      </div>
    </details>
  );
}
