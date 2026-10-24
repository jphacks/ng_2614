import Link from "next/link";
import { formatDate } from "@/components/theme/format";
import type { ResearchTheme } from "@/lib/types";

export type ProjectCard = {
  theme: ResearchTheme;
  reviewCount: number;
  savedProblemCount: number;
  lastImportedAt?: string; // 最後に取り込んだ日時（判定が無ければ無い）
};

export function ProjectList({ projects }: { projects: ProjectCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {projects.map(
        ({ theme, reviewCount, savedProblemCount, lastImportedAt }) => (
          <li key={theme.id}>
            <Link
              href={`/themes/${theme.id}`}
              className="flex h-full flex-col rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50"
            >
              <p className="font-medium text-gray-900">{theme.name}</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-500">
                {theme.repo}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
                <span
                  className={
                    savedProblemCount > 0
                      ? "rounded bg-red-50 px-2 py-0.5 text-red-700"
                      : "rounded bg-gray-100 px-2 py-0.5 text-gray-600"
                  }
                >
                  保存した問題 {savedProblemCount}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                  取り込み {reviewCount}
                </span>
                <span className="text-gray-500">
                  {lastImportedAt
                    ? `最後の取り込み ${formatDate(lastImportedAt)}`
                    : "まだ取り込んでいません"}
                </span>
              </div>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
