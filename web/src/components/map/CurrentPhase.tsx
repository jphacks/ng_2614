"use client";

// S-7 の上に出す、今の段階（F-15）。今の段階（今ここのタスクがある工程）が無ければ何も出さない。
// 今ここのタスクそのものは出さない

import { currentFocus } from "@/lib/map/summary";
import type { WorkflowMap } from "@/lib/types";
import { PhaseSteps } from "./PhaseSteps";

export function CurrentPhase({ map }: { map: WorkflowMap }) {
  const { current } = currentFocus(map);
  if (!current) return null;
  const phase = map.phases.find((p) => p.id === current.phaseId);
  if (!phase) return null;

  return (
    <section
      aria-label="今の段階"
      className="rounded-[4px] border-2 border-accent bg-sheet p-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-serif text-base font-bold text-ink">今は「{phase.name}」の段階</p>
        <PhaseSteps map={map} currentPhaseId={phase.id} />
      </div>
    </section>
  );
}
