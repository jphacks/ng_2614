export function FileList({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-3">関係するファイル</span>
      {files.map((f) => (
        <code
          key={f}
          className="bg-paper-2 px-1.5 py-0.5 font-mono text-ink"
        >
          {f}
        </code>
      ))}
    </div>
  );
}
