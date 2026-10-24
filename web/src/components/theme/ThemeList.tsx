import Link from "next/link";
import type { ResearchTheme } from "@/lib/types";
import { formatDate } from "./format";

export function ThemeList({ themes }: { themes: ResearchTheme[] }) {
  if (themes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        まだ研究テーマがありません。下のフォームから登録してください。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {themes.map((theme) => (
        <li key={theme.id}>
          <Link
            href={`/themes/${theme.id}`}
            className="block rounded-md border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50"
          >
            <p className="font-medium text-gray-900">{theme.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              <span className="font-mono">{theme.repo}</span>
              <span className="mx-2">・</span>
              更新: {formatDate(theme.updatedAt)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
