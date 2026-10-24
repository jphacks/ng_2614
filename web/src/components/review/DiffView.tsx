// コードの差分（unified diff の patch）の表示（F-14）。追加は緑、削除は赤で示し、行番号を付ける。

import type { DiffFile } from "@/lib/api-types";
import { parsePatch } from "./patch-lines";

const STATUS_LABEL: Record<string, string> = {
  added: "追加",
  removed: "削除",
  modified: "変更",
  renamed: "名前の変更",
};

const ROW_CLASS = {
  add: "bg-green-50 text-green-900",
  del: "bg-red-50 text-red-900",
  ctx: "text-gray-700",
} as const;

const NUM_CLASS = {
  add: "bg-green-100/60 text-green-700",
  del: "bg-red-100/60 text-red-700",
  ctx: "text-gray-400",
} as const;

const MARK = { add: "+", del: "-", ctx: " " } as const;

// 行番号（元・変更後）と、変更のない行を省いたところの印を付けて出す
export function PatchView({ patch }: { patch: string }) {
  const rows = parsePatch(patch);
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white font-mono text-xs leading-5">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, i) => {
            if (row.kind === "gap") {
              // 先頭のハンクで省いた行も見出しも無ければ、何も出さない
              if (row.skipped === 0 && !row.context && i === 0) return null;
              return (
                <tr key={i} className="bg-blue-50 text-blue-800">
                  <td colSpan={4} className="px-3 py-0.5 font-sans">
                    {row.skipped > 0 ? `⋯ 変更のない ${row.skipped} 行` : "⋯"}
                    {row.context && (
                      <span className="ml-2 font-mono text-blue-700/80">
                        {row.context}
                      </span>
                    )}
                  </td>
                </tr>
              );
            }
            if (row.kind === "note") {
              return (
                <tr key={i} className="text-gray-400">
                  <td colSpan={4} className="px-3">
                    {row.text}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={i} className={ROW_CLASS[row.kind]}>
                <td
                  className={`w-10 select-none border-r border-gray-100 px-2 text-right tabular-nums ${NUM_CLASS[row.kind]}`}
                >
                  {row.oldNo ?? ""}
                </td>
                <td
                  className={`w-10 select-none border-r border-gray-100 px-2 text-right tabular-nums ${NUM_CLASS[row.kind]}`}
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
}: {
  file: DiffFile;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group/file rounded-md border border-gray-200"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 bg-gray-50 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="text-gray-400 group-open/file:rotate-90">▶</span>
        <code className="font-mono text-gray-900">{file.filename}</code>
        <span className="text-xs text-gray-500">
          {STATUS_LABEL[file.status] ?? file.status}
        </span>
        <span className="text-xs text-green-700">+{file.additions}</span>
        <span className="text-xs text-red-700">-{file.deletions}</span>
      </summary>
      <div className="p-2">
        {file.patch ? (
          <PatchView patch={file.patch} />
        ) : (
          <p className="px-1 text-xs text-gray-500">
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
}: {
  files: DiffFile[];
  openAll?: boolean;
}) {
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <FileDiff key={f.filename} file={f} defaultOpen={openAll} />
      ))}
    </div>
  );
}

// 判定の各項目に、関係するファイルの差分を開いて見られるようにする
export function FindingDiffs({ files }: { files: DiffFile[] }) {
  if (files.length === 0) return null;
  return (
    <details className="group/finding">
      <summary className="cursor-pointer list-none text-xs font-medium text-blue-700 hover:underline [&::-webkit-details-marker]:hidden">
        <span className="inline-block group-open/finding:rotate-90">▶</span>{" "}
        コードの差分を見る（{files.length} ファイル）
      </summary>
      <div className="mt-2">
        {/* 1ファイルだけなら、開いたらすぐ中身が見えるようにする */}
        <FileDiffList files={files} openAll={files.length === 1} />
      </div>
    </details>
  );
}
