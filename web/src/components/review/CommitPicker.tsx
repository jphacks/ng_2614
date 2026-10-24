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
      <p className="text-sm text-gray-600">
        このリポジトリにコミットが見つかりませんでした。
      </p>
    );
  }
  return (
    <ul className="max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200">
      {commits.map((c) => {
        const selected = c.sha === selectedSha;
        return (
          <li key={c.sha}>
            <label
              className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm ${
                selected ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="commit"
                className="mt-1"
                checked={selected}
                disabled={disabled}
                onChange={() => onSelect(c.sha)}
              />
              <span className="min-w-0">
                <span className="block break-words font-medium">
                  {firstLine(c.message) || "（メッセージなし）"}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  <code className="font-mono">{shortSha(c.sha)}</code>
                  {" ・ "}
                  {c.author}
                  {" ・ "}
                  {formatDate(c.date)}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
