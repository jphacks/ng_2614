// 今の段階（F-15）：工程の並びの中で、今ここのタスクがある工程を塗って見せる。
// 帯（横・縦）と S-7 で使う

import { sortedPhases } from "@/lib/map/view";
import type { WorkflowMap } from "@/lib/types";

export function PhaseSteps({
  map,
  currentPhaseId,
  size = "md",
}: {
  map: WorkflowMap;
  currentPhaseId: string;
  size?: "sm" | "md";
}) {
  const phases = sortedPhases(map);
  const text = size === "sm" ? "text-[10px] leading-4 px-1" : "text-xs leading-5 px-2";
  return (
    <ol aria-label="研究の工程" className="flex flex-wrap items-center gap-0.5">
      {phases.map((phase, i) => {
        const current = phase.id === currentPhaseId;
        return (
          <li key={phase.id} className="flex items-center gap-0.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-gray-400">
                ›
              </span>
            )}
            <span
              aria-current={current ? "step" : undefined}
              className={`rounded-full ${text} ${
                current
                  ? "bg-indigo-600 font-semibold text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200"
              }`}
            >
              {phase.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
