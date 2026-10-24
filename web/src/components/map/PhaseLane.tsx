"use client";

import { useState } from "react";
import type { MapPhase, WorkflowMap } from "@/lib/types";
import { tasksInPhase } from "@/lib/map/view";
import { AddTaskForm, type AddTaskValues } from "./AddTaskForm";
import {
  matchesFilter,
  SOURCE_KIND_LABEL,
  type MilestoneFilter,
} from "./labels";
import { TaskCard } from "./TaskCard";

export function PhaseLane({
  map,
  phase,
  filter,
  selectedId,
  changedIds,
  expandedIds,
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
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddTask: (phaseId: string, values: AddTaskValues) => boolean;
}) {
  const [adding, setAdding] = useState(false);
  const tasks = tasksInPhase(map, phase.id);

  return (
    <section
      aria-label={`レーン：${phase.name}`}
      className="w-60 min-w-60 shrink-0 rounded-md bg-gray-50 p-2"
    >
      <header className="mb-2 px-1">
        <h3 className="text-sm font-bold text-gray-800">{phase.name}</h3>
        {phase.kinds.length > 0 && (
          <p className="text-xs text-gray-500">
            {phase.kinds.map((k) => SOURCE_KIND_LABEL[k]).join("・")}
          </p>
        )}
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
