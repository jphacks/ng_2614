import type { SavedProblem } from "@/lib/storage";
import { ProblemItem } from "./ProblemItem";

export function ProblemLog({ problems }: { problems: SavedProblem[] }) {
  if (problems.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        保存した問題はまだありません。変更を取り込んで判定し、隠れた問題を保存するとここに並びます。
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {problems.map((problem) => (
        <ProblemItem
          key={`${problem.review.id}:${problem.finding.id}`}
          problem={problem}
        />
      ))}
    </ul>
  );
}
