import type { ResearchTheme } from "@/lib/types";

const ROWS: { key: "question" | "method" | "evaluation"; label: string }[] = [
  { key: "question", label: "問い" },
  { key: "method", label: "手法（ベースラインを含む）" },
  { key: "evaluation", label: "評価" },
];

export function PurposeView({ theme }: { theme: ResearchTheme }) {
  return (
    <dl className="space-y-3">
      {ROWS.map(({ key, label }) => (
        <div key={key}>
          <dt className="text-xs font-medium text-ink-3">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {theme[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
