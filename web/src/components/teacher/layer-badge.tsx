import type { QuestionLayer } from "@/lib/types";

export const LAYER_LABEL: Record<QuestionLayer, string> = {
  research: "研究手法",
  implementation: "実装",
};

// 色の札ではなく、枠だけの小さなラベルで層を見せる
const LAYER_STYLE: Record<QuestionLayer, string> = {
  research: "text-ink",
  implementation: "text-ink-2",
};

export function LayerBadge({ layer }: { layer: QuestionLayer }) {
  return <span className={`tag ${LAYER_STYLE[layer]}`}>{LAYER_LABEL[layer]}</span>;
}
