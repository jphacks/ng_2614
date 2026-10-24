export function FileList({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-gray-500">関係するファイル</span>
      {files.map((f) => (
        <code
          key={f}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700"
        >
          {f}
        </code>
      ))}
    </div>
  );
}
