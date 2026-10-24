import type { QuestionLayer } from "@/lib/types";

export const LAYER_LABEL: Record<QuestionLayer, string> = {
  research: "研究手法",
  implementation: "実装",
};

const LAYER_STYLE: Record<QuestionLayer, string> = {
  research: "bg-indigo-100 text-indigo-800",
  implementation: "bg-emerald-100 text-emerald-800",
};

export function LayerBadge({ layer }: { layer: QuestionLayer }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${LAYER_STYLE[layer]}`}
    >
      {LAYER_LABEL[layer]}
    </span>
  );
}
