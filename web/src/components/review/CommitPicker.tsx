import type { CommitSummary } from "@/lib/api-types";
import { firstLine, formatDate, shortSha } from "./labels";

type Props = {
  commits: CommitSummary[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  disabled?: boolean;
};

export function CommitPicker({
  commits,
  selectedSha,
  onSelect,
  disabled,
}: Props) {
  if (commits.length === 0) {
    return (
      <p className="text-sm text-ink-2">
        このリポジトリにコミットが見つかりませんでした。
      </p>
    );
  }
  return (
    <ul className="max-h-80 divide-y divide-hair overflow-y-auto border-y border-ink">
      {commits.map((c) => {
        const selected = c.sha === selectedSha;
        return (
          <li key={c.sha}>
            <label
              className={`flex cursor-pointer items-start gap-3 border-l-2 px-3 py-2.5 text-sm ${
                selected
                  ? "border-ink bg-paper-2"
                  : "border-transparent hover:bg-paper-2"
              }`}
            >
              <input
                type="radio"
                name="commit"
                className="mt-1 accent-accent"
                checked={selected}
                disabled={disabled}
                onChange={() => onSelect(c.sha)}
              />
              <span className="min-w-0">
                <span className="block break-words font-medium">
                  {firstLine(c.message) || "（メッセージなし）"}
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-3">
                  <code className="font-mono">{shortSha(c.sha)}</code>
                  <span>{c.author}</span>
                  <span>{formatDate(c.date)}</span>
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
