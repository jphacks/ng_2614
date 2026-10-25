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

// 縦の帯（右のサイドバー）の中の1レーン。タスクを1行ずつ、サブタスクはトグルで出す

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
      className={`tag px-1 text-[10px] leading-4 ${className}`}
    >
      {children}
    </span>
  );
}

function SideTaskRow({
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
  const subId = `side-sub-${task.id}`;
  const href = `/themes/${encodeURIComponent(themeId)}/map?task=${encodeURIComponent(task.id)}`;

  return (
    <li
      className={`min-w-0 border bg-paper px-1.5 py-1 ${
        isFocus ? "border-accent ring-1 ring-accent" : "border-hair"
      }`}
    >
      <div className="flex flex-wrap items-center gap-0.5">
        <span
          className={`tag px-1 text-[10px] leading-4 ${STATUS_BADGE[status]}`}
        >
          {statusLabel(summary.phase, status)}
        </span>
        {isFocus && (
          <Mark className="border-accent bg-accent text-paper">今ここ</Mark>
        )}
        {isChanged && <Mark className="text-ink">更新</Mark>}
        {task.flag === "unrecorded" && (
          <Mark
            className="border-ink-3 bg-marker text-ink"
            title="どのドキュメントにも出てこない実装です"
          >
            記録なし
          </Mark>
        )}
        {impact && (
          <Mark
            className="text-pen"
            title={impact.reason ?? "隠れた問題が研究の前提に影響しています"}
          >
            影響あり
          </Mark>
        )}
      </div>
      <Link
        href={href}
        className="mt-0.5 block break-words text-[11px] font-medium leading-snug text-ink hover:underline"
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
            className="mt-0.5 text-[10px] leading-4 text-ink-2 hover:text-ink hover:underline"
          >
            {subOpen ? "▾" : "▸"} サブタスク {subtasks.length}
          </button>
          {subOpen && (
            <ul
              id={subId}
              className="mt-0.5 space-y-0.5 border-l border-hair pl-1.5"
            >
              {subtasks.map((s) => {
                const icon = STATUS_ICON[s.status];
                return (
                  <li
                    key={s.id}
                    className="relative flex items-start gap-1 text-[11px] leading-snug"
                  >
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
                      className={`min-w-0 break-words ${
                        s.status === "rejected"
                          ? "text-ink-3 line-through"
                          : "text-ink-2"
                      }`}
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

export function SideLane({
  map,
  themeId,
  summary,
  changedIds,
  focusIds,
  isCurrentPhase = false,
  openSubs,
  onToggleSub,
}: {
  map: WorkflowMap;
  themeId: string;
  summary: PhaseSummary;
  changedIds: Set<string>;
  focusIds: Set<string>;
  isCurrentPhase?: boolean; // 今ここのタスクがある工程（今の段階）
  openSubs: Set<string>;
  onToggleSub: (taskId: string) => void;
}) {
  const tasks = tasksInPhase(map, summary.phase.id);
  return (
    <section
      aria-label={`レーン：${summary.phase.name}`}
      className={`min-w-0 border bg-paper p-1 ${
        isCurrentPhase ? "border-accent ring-1 ring-accent" : "border-hair"
      }`}
    >
      <h3 className="rule-head mb-1 flex items-baseline justify-between gap-1 px-0.5 text-[11px] font-semibold leading-tight text-ink">
        <span className="min-w-0 break-words">
          {summary.phase.name}
          {isCurrentPhase && (
            <span className="ml-1 bg-accent px-1 text-[10px] font-semibold text-paper">
              今の段階
            </span>
          )}
        </span>
        <span className="shrink-0 font-normal text-ink-3">
          {summary.counts.done}/{summary.total}
        </span>
      </h3>
      {tasks.length === 0 ? (
        <p className="px-0.5 text-[10px] text-ink-3">タスクなし</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <SideTaskRow
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
