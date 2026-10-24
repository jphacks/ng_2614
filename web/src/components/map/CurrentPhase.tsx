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
      className="rounded-md border border-indigo-200 bg-indigo-50 p-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-base font-bold text-indigo-900">今は「{phase.name}」の段階</p>
        <PhaseSteps map={map} currentPhaseId={phase.id} />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="font-semibold text-indigo-800">今ここ：</span>
        <span className={`rounded px-1.5 text-xs font-medium leading-5 ${STATUS_BADGE[status]}`}>
          {statusLabel(phase, status)}
        </span>
        <button
          type="button"
          onClick={() => onSelect(current.id)}
          className="text-left font-medium text-gray-900 hover:underline"
        >
          {current.title}
        </button>
      </p>
    </section>
  );
}
