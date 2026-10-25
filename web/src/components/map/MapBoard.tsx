"use client";

import { useState } from "react";
import type { WorkflowMap } from "@/lib/types";
import { currentFocus, phaseSummaries, progressText } from "@/lib/map/summary";
import type { AddTaskValues } from "./AddTaskForm";
import { milestoneStyle, type MilestoneFilter } from "./labels";
import { PhaseLane } from "./PhaseLane";

// マイルストーンの絞り込みと、レーンを横に並べたマップ。レーンは初め、レーン名と進み具合だけを出す。
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
  const summaries = phaseSummaries(map);
  const changedIds = new Set(map.lastUpdate?.changedTaskIds ?? []);
  const currentPhaseId = currentFocus(map).current?.phaseId;
  // レーンは初め閉じておき、レーン名をクリックしたレーンだけを開く（マウスを合わせただけでは開かない）。
  // タスクを選んだときは、そのタスクのレーンを開く
  const selectedLane = map.tasks.find((t) => t.id === selectedId)?.phaseId;
  const [openLanes, setOpenLanes] = useState<Set<string>>(
    () => new Set(selectedLane ? [selectedLane] : []),
  );
  const [openedForSelection, setOpenedForSelection] = useState(selectedLane);
  if (selectedLane !== openedForSelection) {
    setOpenedForSelection(selectedLane);
    if (selectedLane) setOpenLanes((prev) => new Set(prev).add(selectedLane));
  }

  function toggleLane(phaseId: string) {
    setOpenLanes((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  // 「すべて開く／閉じる」は、レーンとカードのトグルをまとめて開く／閉じる
  function setAll(open: boolean) {
    setOpenLanes(open ? new Set(summaries.map((s) => s.phase.id)) : new Set());
    onSetAllExpanded(open);
  }

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
            onClick={() => setAll(true)}
            className="btn btn-sm"
          >
            すべて開く
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="btn btn-sm"
          >
            すべて閉じる
          </button>
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        {/* レーンは盤面の幅を等分する（最小 160px）。詳細パネルが開いて狭くなっても縮めて収め、入らないときだけこの部分を横にスクロールする */}
        <div className="flex items-start gap-3">
          {summaries.map((s, i) => (
            <PhaseLane
              key={s.phase.id}
              map={map}
              phase={s.phase}
              index={i}
              complete={s.steps.total > 0 && s.steps.done === s.steps.total}
              progress={progressText(s)}
              open={openLanes.has(s.phase.id)}
              onToggleOpen={toggleLane}
              filter={filter}
              selectedId={selectedId}
              changedIds={changedIds}
              expandedIds={expandedIds}
              isCurrentPhase={s.phase.id === currentPhaseId}
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
