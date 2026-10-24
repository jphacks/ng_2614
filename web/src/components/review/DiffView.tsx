// コードの差分（unified diff の patch）の表示（F-14）。追加は緑、削除は赤で示す。

import type { DiffFile } from "@/lib/api-types";

const STATUS_LABEL: Record<string, string> = {
  added: "追加",
  removed: "削除",
  modified: "変更",
  renamed: "名前の変更",
};

function lineClass(line: string): string {
  if (line.startsWith("@@")) return "bg-blue-50 text-blue-800";
  if (line.startsWith("+")) return "bg-green-50 text-green-900";
  if (line.startsWith("-")) return "bg-red-50 text-red-900";
  if (line.startsWith("\\")) return "text-gray-400"; // \ No newline at end of file
  return "text-gray-700";
}

export function PatchView({ patch }: { patch: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-gray-200 bg-white py-1 font-mono text-xs leading-5">
      {patch.split("\n").map((line, i) => (
        <span
          key={i}
          className={`block whitespace-pre px-3 ${lineClass(line)}`}
        >
          {line || " "}
        </span>
      ))}
    </pre>
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
