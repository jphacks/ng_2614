"use client";

import type { WorkflowMap } from "@/lib/types";
import { currentFocus } from "@/lib/map/summary";
import { sortedPhases } from "@/lib/map/view";
import type { AddTaskValues } from "./AddTaskForm";
import { milestoneStyle, type MilestoneFilter } from "./labels";
import { PhaseLane } from "./PhaseLane";

// マイルストーンの絞り込みと、レーンを横に並べたマップ。
// はみ出したときは、マップの部分だけが横にスクロールする
export function MapBoard({
  map,
  filter,
  onFilterChange,
  selectedId,
  expandedIds,
  onToggle,
  onSetAllExpanded,
  onSelect,
  onAddTask,
}: {
  map: WorkflowMap;
  filter: MilestoneFilter;
  onFilterChange: (filter: MilestoneFilter) => void;
  selectedId: string | undefined;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSetAllExpanded: (open: boolean) => void;
  onSelect: (id: string) => void;
  onAddTask: (phaseId: string, values: AddTaskValues) => boolean;
}) {
  const phases = sortedPhases(map);
  const changedIds = new Set(map.lastUpdate?.changedTaskIds ?? []);
  const currentPhaseId = currentFocus(map).current?.phaseId;

  const options: { value: MilestoneFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    ...map.milestones.map((m) => ({ value: m.id, label: m.title })),
    { value: "none", label: "マイルストーンなし" },
  ];

  return (
    <div className="min-w-0 space-y-3">
      <div
        role="group"
        aria-label="マイルストーンで絞り込む"
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="text-xs text-ink-3">マイルストーン：</span>
        {options.map((o) => {
          const active = filter === o.value;
          const color =
            o.value !== "all" && o.value !== "none"
              ? milestoneStyle(map, o.value)
              : "text-ink-2";
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(o.value)}
              className={`border px-2 py-1 text-xs ${
                active
                  ? "border-accent bg-accent font-bold text-paper"
                  : `${color} hover:bg-paper-2`
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => onSetAllExpanded(true)}
            className="btn btn-sm"
          >
            すべて開く
          </button>
          <button
            type="button"
            onClick={() => onSetAllExpanded(false)}
            className="btn btn-sm"
          >
            すべて閉じる
          </button>
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        {/* レーンは盤面の幅を等分する（最小 160px）。詳細パネルが開いて狭くなっても縮めて収め、入らないときだけこの部分を横にスクロールする */}
        <div className="flex items-start gap-3">
          {phases.map((phase) => (
            <PhaseLane
              key={phase.id}
              map={map}
              phase={phase}
              filter={filter}
              selectedId={selectedId}
              changedIds={changedIds}
              expandedIds={expandedIds}
              isCurrentPhase={phase.id === currentPhaseId}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddTask={onAddTask}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
