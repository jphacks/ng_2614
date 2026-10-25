import type { ResearchTheme } from "@/lib/types";

const ROWS: { key: "question" | "method" | "evaluation"; label: string }[] = [
  { key: "question", label: "問い" },
  { key: "method", label: "手法（ベースラインを含む）" },
  { key: "evaluation", label: "評価" },
];

// 研究の目的（問い・手法・評価）。紙の地の上に白い一枚を置き、項目の間を細い罫線で区切って読みやすくする
export function PurposeView({ theme }: { theme: ResearchTheme }) {
  return (
    <dl className="divide-y divide-hair rounded-[4px] border border-hair bg-sheet">
      {ROWS.map(({ key, label }) => (
        <div key={key} className="px-4 py-3">
          <dt className="text-xs font-bold text-ink-2">{label}</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {theme[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
