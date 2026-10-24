"use client";

import Link from "next/link";
import type { PhaseSummary } from "@/lib/map/summary";
import {
  effectiveStatus,
  linksOf,
  statusLabel,
  subtasksOf,
  tasksInPhase,
} from "@/lib/map/view";
import type { MapTask, WorkflowMap } from "@/lib/types";
import { STATUS_BADGE, STATUS_ICON } from "@/components/map/labels";

// 開いた帯の中の1レーン。タスクを1行ずつ、サブタスクはトグルで出す

function Mark({
  className,
  title,
  children,
}: {
  className: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-block rounded px-1 text-[10px] font-medium leading-4 ${className}`}
    >
      {children}
    </span>
  );
}

function TaskRow({
  map,
  themeId,
  summary,
  task,
  isFocus,
  isChanged,
  subOpen,
  onToggleSub,
}: {
  map: WorkflowMap;
  themeId: string;
  summary: PhaseSummary;
  task: MapTask;
  isFocus: boolean;
  isChanged: boolean;
  subOpen: boolean;
  onToggleSub: () => void;
}) {
  const status = effectiveStatus(map, task);
  const subtasks = subtasksOf(map, task.id);
  const { incoming, outgoing } = linksOf(map, task.id);
  const impact = [...incoming, ...outgoing].find((l) => l.kind === "impact");
  const subId = `strip-sub-${task.id}`;
  const href = `/themes/${encodeURIComponent(themeId)}/map?task=${encodeURIComponent(task.id)}`;

  return (
    <li
      className={`rounded border px-1.5 py-1 ${
        isFocus ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={`inline-block rounded px-1 text-[10px] font-medium leading-4 ${STATUS_BADGE[status]}`}
        >
          {statusLabel(summary.phase, status)}
        </span>
        {isFocus && (
          <Mark className="bg-indigo-100 text-indigo-800">今ここ</Mark>
        )}
        {isChanged && <Mark className="bg-sky-100 text-sky-800">更新</Mark>}
        {task.flag === "unrecorded" && (
          <Mark
            className="bg-amber-100 text-amber-800"
            title="どのドキュメントにも出てこない実装です"
          >
            記録なし
          </Mark>
        )}
        {impact && (
          <Mark
            className="bg-red-100 text-red-700"
            title={impact.reason ?? "隠れた問題が研究の前提に影響しています"}
          >
            影響あり
          </Mark>
        )}
      </div>
      <Link
        href={href}
        className="mt-0.5 block text-[11px] font-medium leading-snug text-gray-900 hover:underline"
      >
        {task.title}
      </Link>
      {subtasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggleSub}
            aria-expanded={subOpen}
            aria-controls={subId}
            className="mt-0.5 text-[11px] leading-snug text-gray-600 hover:text-gray-900 hover:underline"
          >
            {subOpen ? "▾" : "▸"} サブタスク {subtasks.length}
          </button>
          {subOpen && (
            <ul id={subId} className="mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
              {subtasks.map((s) => {
                const icon = STATUS_ICON[s.status];
                return (
                  <li key={s.id} className="relative flex items-start gap-1 text-[11px] leading-snug">
                    <span
                      className={`shrink-0 ${icon.className}`}
                      title={statusLabel(summary.phase, s.status)}
                    >
                      {icon.mark}
                    </span>
                    <span className="sr-only">
                      {statusLabel(summary.phase, s.status)}
                    </span>
                    <span
                      className={
                        s.status === "rejected"
                          ? "text-gray-400 line-through"
                          : "text-gray-700"
                      }
                    >
                      {s.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

export function StripLane({
  map,
  themeId,
  summary,
  changedIds,
  focusIds,
  openSubs,
  onToggleSub,
}: {
  map: WorkflowMap;
  themeId: string;
  summary: PhaseSummary;
  changedIds: Set<string>;
  focusIds: Set<string>;
  openSubs: Set<string>;
  onToggleSub: (taskId: string) => void;
}) {
  const tasks = tasksInPhase(map, summary.phase.id);
  return (
    <section
      aria-label={`レーン：${summary.phase.name}`}
      className="min-w-0 rounded-md bg-gray-50 p-1"
    >
      <h3 className="mb-1 flex items-baseline justify-between gap-1 px-0.5 text-[11px] font-semibold text-gray-800">
        <span className="truncate">{summary.phase.name}</span>
        <span className="shrink-0 font-normal text-gray-500">
          {summary.counts.done}/{summary.total}
        </span>
      </h3>
      {tasks.length === 0 ? (
        <p className="px-0.5 text-[11px] text-gray-400">タスクなし</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              map={map}
              themeId={themeId}
              summary={summary}
              task={t}
              isFocus={focusIds.has(t.id)}
              isChanged={changedIds.has(t.id)}
              subOpen={openSubs.has(t.id)}
              onToggleSub={() => onToggleSub(t.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
