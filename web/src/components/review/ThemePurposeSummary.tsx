import type { ResearchTheme } from "@/lib/types";

export function ThemePurposeSummary({ theme }: { theme: ResearchTheme }) {
  const rows: [string, string][] = [
    ["問い", theme.question],
    ["手法", theme.method],
    ["評価", theme.evaluation],
  ];
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-bold text-gray-700">研究の目的</h2>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-10 shrink-0 text-gray-500">{label}</dt>
            <dd className="whitespace-pre-wrap text-gray-800">
              {value || "（未入力）"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
