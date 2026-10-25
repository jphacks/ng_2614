"use client";

import { useState } from "react";
import type { MapPhase, WorkflowMap } from "@/lib/types";
import { tasksInPhase } from "@/lib/map/view";
import { AddTaskForm, type AddTaskValues } from "./AddTaskForm";
import { matchesFilter, type MilestoneFilter } from "./labels";
import { StepMark } from "./StepMark";
import { TaskCard } from "./TaskCard";

// レーンは初め、番号の丸とレーン名、進み具合（サブタスクの済み/全体）だけを出す（今の段階は番号の丸の色だけで示す）。マウスを合わせると（キーボードではレーン名を選ぶと）
// レーン名をクリックするとカードを開き、もう一度クリックで閉じる（マウスを合わせただけでは開かない）。開くかどうかは親（MapBoard）が持つ
export function PhaseLane({
  map,
  phase,
  index,
  complete,
  progress,
  open,
  filter,
  selectedId,
  changedIds,
  expandedIds,
  isCurrentPhase = false,
  onToggleOpen,
  onToggle,
  onSelect,
  onAddTask,
}: {
  map: WorkflowMap;
  phase: MapPhase;
  index: number; // 0 から数えた工程の順（番号の丸に出す）
  complete: boolean; // サブタスクが全部済んだ（番号の丸を ✓ にする）
  progress: string; // 進み具合「済み/全体」（サブタスクの数。数えるものが無ければ「—」）
  open: boolean; // カードを出しているか
  filter: MilestoneFilter;
  selectedId: string | undefined;
  changedIds: Set<string>;
  expandedIds: Set<string>;
  isCurrentPhase?: boolean; // 今ここのタスクがある工程（今の段階）
  onToggleOpen: (phaseId: string) => void;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddTask: (phaseId: string, values: AddTaskValues) => boolean;
}) {
  const [adding, setAdding] = useState(false);
  const tasks = tasksInPhase(map, phase.id);
  const bodyId = `lane-body-${phase.id}`;

  return (
    <section
      aria-label={`レーン：${phase.name}`}
      className="min-w-40 max-w-md flex-1 basis-0 rounded-[4px] border border-hair bg-paper-2/60 p-2"
    >
      <header className={`px-1 ${open ? "mb-2" : ""}`}>
        <h3 className="rule-head text-sm font-bold text-ink">
          <button
            type="button"
            onClick={() => onToggleOpen(phase.id)}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={`${phase.name}：サブタスクの進み具合 ${progress}${isCurrentPhase ? "（今の段階）" : ""}。${open ? "クリックで閉じる" : "クリックで開く"}`}
            className="flex w-full items-center gap-1.5 text-left hover:underline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <span aria-hidden="true" className="text-xs font-normal text-ink-3">
              {open ? "▾" : "▸"}
            </span>
            <StepMark index={index} complete={complete} current={isCurrentPhase} />
            {phase.name}
            <span aria-hidden="true" className="ml-auto font-mono text-sm font-normal tabular-nums text-ink-2">
              {progress}
            </span>
          </button>
        </h3>
      </header>
      <div id={bodyId} hidden={!open}>
        {tasks.length === 0 && !adding && (
          <p className="px-1 py-2 text-xs text-ink-3">タスクはありません</p>
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
              className="w-full border border-dashed border-ink-3 px-2 py-1 text-xs text-ink-2 hover:border-ink hover:text-ink"
            >
              ＋ タスクを足す
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
