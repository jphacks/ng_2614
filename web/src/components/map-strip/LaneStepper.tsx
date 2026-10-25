"use client";

import { useState } from "react";
import { progressText, type PhaseSummary } from "@/lib/map/summary";
import { effectiveStatus, statusLabel, subtasksOf, tasksInPhase } from "@/lib/map/view";
import type { WorkflowMap } from "@/lib/types";
import { STATUS_ICON } from "@/components/map/labels";

// 縦の帯を開いたときの、レーンの進み具合のステッププログレスバー。
// レーンを工程の順に縦の線でつなぎ、各レーンに印（済み ✓・番号。今の段階は番号の丸を藍にするだけで、行は他と同じ）と、サブタスクの済み/全体の数と目盛りを出す。
// レーンの行をクリックすると、その下にレーンのタスクをトグルで開く。タスクをクリックすると、
// そのタスクのサブタスクを帯の左に重ねて出す（親の onTaskClick）

// 目盛りを1つずつ描くのはこの数まで。超えたら1本の棒で割合を見せる
const MAX_TICKS = 12;

function Ticks({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  if (total > MAX_TICKS) {
    return (
      <span aria-hidden="true" className="mt-1 block h-1.5 w-full bg-hair">
        <span className="block h-full bg-mint" style={{ width: `${(done / total) * 100}%` }} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="mt-1 flex w-full gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 ${i < done ? "bg-mint" : "bg-hair"}`} />
      ))}
    </span>
  );
}

export function LaneStepper({
  map,
  summaries,
  currentPhaseId,
  focusIds,
  shownTaskId,
  onTaskClick,
}: {
  map: WorkflowMap;
  summaries: PhaseSummary[];
  currentPhaseId: string | undefined;
  focusIds: Set<string>; // 今ここのタスク
  shownTaskId: string | null; // サブタスクを重ねて出しているタスク
  onTaskClick: (taskId: string, el: HTMLElement) => void;
}) {
  const [openLanes, setOpenLanes] = useState<Set<string>>(() => new Set());

  function toggleLane(phaseId: string) {
    setOpenLanes((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  return (
    <ol aria-label="レーンごとの進み具合" className="mt-2 pb-2">
      {summaries.map((s, i) => {
        const { done, total } = s.steps;
        const complete = total > 0 && done === total;
        const isCurrent = s.phase.id === currentPhaseId;
        const isOpen = openLanes.has(s.phase.id);
        const last = i === summaries.length - 1;
        const progress = progressText(s);
        const bodyId = `side-lane-${s.phase.id}`;
        const tasks = isOpen ? tasksInPhase(map, s.phase.id) : [];
        return (
          <li key={s.phase.id} className="relative pl-7">
            {/* 次の工程へつなぐ線。済んだ工程からの線は若葉にする */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-[11px] top-7 w-0.5 ${complete ? "bg-mint" : "bg-hair"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[12px] font-bold ${
                complete
                  ? "border-mint bg-mint text-paper"
                  : isCurrent
                    ? "border-accent bg-accent text-paper"
                    : "border-hair bg-paper text-ink-3"
              }`}
            >
              {complete ? "✓" : i + 1}
            </span>
            <button
              type="button"
              onClick={() => toggleLane(s.phase.id)}
              aria-expanded={isOpen}
              aria-controls={bodyId}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${s.phase.name}：サブタスク ${progress}${complete ? "（済み）" : ""}${isCurrent ? "（今の段階）" : ""}`}
              className={`block w-full border border-transparent px-1.5 py-1 text-left text-[13px] leading-5 text-ink-2 hover:bg-paper-2 ${
                isOpen ? "bg-paper-2" : ""
              }`}
            >
              <span className="flex items-baseline gap-1">
                <span aria-hidden="true" className="text-[11px] text-ink-3">
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.phase.name}</span>
                <span aria-hidden="true" className="shrink-0 font-mono tabular-nums">
                  {progress}
                </span>
              </span>
              <Ticks done={done} total={total} />
            </button>

            <div id={bodyId} hidden={!isOpen} className="mb-2 mt-1">
              {isOpen && tasks.length === 0 && (
                <p className="px-1.5 text-[12px] text-ink-3">タスクなし</p>
              )}
              {tasks.length > 0 && (
                <ul className="space-y-0.5">
                  {tasks.map((t) => {
                    const status = effectiveStatus(map, t);
                    const icon = STATUS_ICON[status];
                    const subs = subtasksOf(map, t.id).filter((x) => x.status !== "rejected");
                    const subsDone = subs.filter((x) => x.status === "done").length;
                    const shown = shownTaskId === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={(e) => onTaskClick(t.id, e.currentTarget)}
                          aria-expanded={shown}
                          aria-controls="map-side-peek"
                          className={`flex w-full items-start gap-1 border px-1.5 py-0.5 text-left text-[12px] leading-snug hover:bg-paper-2 ${
                            shown
                              ? "border-ink bg-paper-2 text-ink"
                              : focusIds.has(t.id)
                                ? "border-accent text-ink"
                                : "border-hair text-ink-2"
                          }`}
                        >
                          <span className={`shrink-0 ${icon.className}`} aria-hidden="true">
                            {icon.mark}
                          </span>
                          <span className="sr-only">{statusLabel(s.phase, status)}</span>
                          <span className="min-w-0 flex-1 break-words">{t.title}</span>
                          {subs.length > 0 && (
                            <span className="shrink-0 font-mono tabular-nums text-ink-3">
                              {subsDone}/{subs.length}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
