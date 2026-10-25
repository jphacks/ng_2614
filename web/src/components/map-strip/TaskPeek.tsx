"use client";

import Link from "next/link";
import { effectiveStatus, statusLabel, subtasksOf } from "@/lib/map/view";
import type { MapPhase, MapTask, WorkflowMap } from "@/lib/types";
import { STATUS_BADGE, STATUS_ICON } from "@/components/map/labels";

// 縦の帯で、クリックしたタスクのサブタスクを帯の左に重ねて出す中身。
// タスクの状態とタイトル（S-7 のそのタスクへ飛ぶ）、サブタスクを1行ずつ（状態の印とタイトル）出す

export function TaskPeek({
  map,
  themeId,
  task,
  phase,
}: {
  map: WorkflowMap;
  themeId: string;
  task: MapTask;
  phase: MapPhase;
}) {
  const status = effectiveStatus(map, task);
  const subtasks = subtasksOf(map, task.id);
  const href = `/themes/${encodeURIComponent(themeId)}/map?task=${encodeURIComponent(task.id)}`;

  return (
    <section aria-label={`タスク：${task.title}`} className="p-2">
      <p className="flex flex-wrap items-center gap-1 text-[12px] leading-4 text-ink-2">
        {phase.name}
        <span className={`tag px-1 text-[12px] leading-4 ${STATUS_BADGE[status]}`}>
          {statusLabel(phase, status)}
        </span>
      </p>
      <Link
        href={href}
        className="mt-0.5 block text-[13px] font-medium leading-snug text-ink hover:underline"
      >
        {task.title}
      </Link>
      {subtasks.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-ink-3">サブタスクはありません</p>
      ) : (
        <ul aria-label="サブタスク" className="mt-1.5 space-y-0.5 border-l border-hair pl-2">
          {subtasks.map((s) => {
            const icon = STATUS_ICON[s.status];
            return (
              <li key={s.id} className="flex items-start gap-1 text-[13px] leading-snug">
                <span aria-hidden="true" className={`shrink-0 ${icon.className}`}>
                  {icon.mark}
                </span>
                <span className="sr-only">{statusLabel(phase, s.status)}</span>
                <span
                  className={
                    s.status === "rejected" ? "text-ink-3 line-through" : "text-ink-2"
                  }
                >
                  {s.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
