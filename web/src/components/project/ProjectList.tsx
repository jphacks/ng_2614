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
              className="flex h-full flex-col rounded-[4px] border border-hair border-t-2 border-t-accent bg-sheet p-4 hover:border-accent hover:bg-accent-soft/40"
            >
              <p className="font-serif font-semibold text-ink">{theme.name}</p>
              <p className="mt-1 break-all font-mono text-xs text-ink-3">
                {theme.repo}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-ink-2">
                <span
                  className={
                    savedProblemCount > 0 ? "font-medium text-pen" : undefined
                  }
                >
                  保存した問題 {savedProblemCount}
                </span>
                <span>取り込み {reviewCount}</span>
                <span className="text-ink-3">
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
