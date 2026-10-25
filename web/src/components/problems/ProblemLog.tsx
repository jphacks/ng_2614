import type { SavedProblem } from "@/lib/storage";
import { ProblemItem } from "./ProblemItem";

export function ProblemLog({ problems }: { problems: SavedProblem[] }) {
  if (problems.length === 0) {
    return (
      <p className="border-y border-hair py-4 text-sm text-ink-3">
        保存した問題はまだありません。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-hair border-y border-hair">
      {problems.map((problem) => (
        <ProblemItem
          key={`${problem.review.id}:${problem.finding.id}`}
          problem={problem}
        />
      ))}
    </ul>
  );
}
