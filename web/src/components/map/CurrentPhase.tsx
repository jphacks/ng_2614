"use client";

// S-7 の上に出す、今の段階と今ここ（F-15）。今ここが無ければ何も出さない

import { currentFocus } from "@/lib/map/summary";
import { effectiveStatus, statusLabel } from "@/lib/map/view";
import type { WorkflowMap } from "@/lib/types";
import { STATUS_BADGE } from "./labels";
import { PhaseSteps } from "./PhaseSteps";

export function CurrentPhase({
  map,
  onSelect,
}: {
  map: WorkflowMap;
  onSelect: (taskId: string) => void;
}) {
  const { current } = currentFocus(map);
  if (!current) return null;
  const phase = map.phases.find((p) => p.id === current.phaseId);
  if (!phase) return null;
  const status = effectiveStatus(map, current);

  return (
    <section
      aria-label="今の段階と今ここ"
      className="rounded-[4px] border-2 border-accent bg-sheet p-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-serif text-base font-bold text-ink">今は「{phase.name}」の段階</p>
        <PhaseSteps map={map} currentPhaseId={phase.id} />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="bg-accent px-1.5 font-semibold text-paper">今ここ：</span>
        <span className={`tag ${STATUS_BADGE[status]}`}>
          {statusLabel(phase, status)}
        </span>
        <button
          type="button"
          onClick={() => onSelect(current.id)}
          className="text-left font-medium text-ink hover:underline"
        >
          {current.title}
        </button>
      </p>
    </section>
  );
}
