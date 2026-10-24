"use client";

import { useState } from "react";
import type { MapPhase, WorkflowMap } from "@/lib/types";
import { tasksInPhase } from "@/lib/map/view";
import { AddTaskForm, type AddTaskValues } from "./AddTaskForm";
import { matchesFilter, type MilestoneFilter } from "./labels";
import { TaskCard } from "./TaskCard";

export function PhaseLane({
  map,
  phase,
  filter,
  selectedId,
  changedIds,
  expandedIds,
  isCurrentPhase = false,
  onToggle,
  onSelect,
  onAddTask,
}: {
  map: WorkflowMap;
  phase: MapPhase;
  filter: MilestoneFilter;
  selectedId: string | undefined;
  changedIds: Set<string>;
  expandedIds: Set<string>;
  isCurrentPhase?: boolean; // 今ここのタスクがある工程（今の段階）
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddTask: (phaseId: string, values: AddTaskValues) => boolean;
}) {
  const [adding, setAdding] = useState(false);
  const tasks = tasksInPhase(map, phase.id);

  return (
    <section
      aria-label={`レーン：${phase.name}`}
      className={`min-w-40 max-w-md flex-1 basis-0 rounded-md p-2 ${
        isCurrentPhase ? "bg-indigo-50 ring-2 ring-indigo-300" : "bg-gray-50"
      }`}
    >
      <header className="mb-2 px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
          {phase.name}
          {isCurrentPhase && (
            <span className="rounded bg-indigo-600 px-1.5 text-xs font-semibold leading-5 text-white">
              今の段階
            </span>
          )}
        </h3>
      </header>
      {tasks.length === 0 && !adding && (
        <p className="px-1 py-2 text-xs text-gray-400">タスクはありません</p>
      )}
      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            map={map}
            task={task}
            phase={phase}
            selectedId={selectedId}
            dimmed={!matchesFilter(filter, task.milestoneId)}
            updated={
              changedIds.has(task.id) ||
              map.tasks.some(
                (t) => t.parentId === task.id && changedIds.has(t.id),
              )
            }
            expanded={expandedIds.has(task.id)}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <div className="mt-2">
        {adding ? (
          <AddTaskForm
            milestones={map.milestones}
            submitLabel="足す"
            onSubmit={(values) => onAddTask(phase.id, values)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-700"
          >
            ＋ タスクを足す
          </button>
        )}
      </div>
    </section>
  );
}
