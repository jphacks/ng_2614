"use client";

import type { MapLink, MapPhase, MapTask, WorkflowMap } from "@/lib/types";
import {
  effectiveStatus,
  linksOf,
  statusLabel,
  subtasksOf,
} from "@/lib/map/view";
import {
  milestoneStyle,
  STATUS_ICON,
  STATUS_ORDER,
  STATUS_SOURCE_HINT,
  STATUS_SOURCE_LABEL,
} from "./labels";
import { StatusBadge } from "./StatusBadge";

type Chip = {
  key: string;
  kind: "flow" | "impact";
  text: string;
  className: string;
  title?: string;
  targetId: string;
};

function buildChips(map: WorkflowMap, taskId: string): Chip[] {
  const { incoming, outgoing } = linksOf(map, taskId);
  const titleOf = (id: string) =>
    map.tasks.find((t) => t.id === id)?.title ?? "（消えたタスク）";
  const flow = "bg-gray-100 text-gray-700 hover:bg-gray-200";
  const impact = "bg-red-50 text-red-700 hover:bg-red-100";
  const chips: Chip[] = [];
  const add = (
    l: MapLink,
    otherId: string,
    hereId: string,
    dir: "in" | "out",
  ) => {
    const other = titleOf(otherId);
    // リンクの端がこのカードのサブタスクなら、どのサブタスクかを添える
    const here = hereId === taskId ? "" : `（${titleOf(hereId)}）`;
    let text: string;
    if (l.kind === "flow") {
      text = dir === "in" ? `← 前：${other}` : `→ 次：${other}`;
    } else {
      text =
        dir === "out"
          ? `研究への影響${here} → ${other}`
          : `影響を受けている${here} ← ${other}`;
    }
    chips.push({
      key: `${l.id}-${dir}`,
      kind: l.kind === "flow" ? "flow" : "impact",
      text,
      className: l.kind === "flow" ? flow : impact,
      title: l.reason,
      targetId: otherId,
    });
  };
  for (const l of incoming) add(l, l.fromTaskId, l.toTaskId, "in");
  for (const l of outgoing) add(l, l.toTaskId, l.fromTaskId, "out");
  return chips;
}

function ChipButton({
  chip,
  onSelect,
}: {
  chip: Chip;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      title={chip.title}
      onClick={() => onSelect(chip.targetId)}
      className={`max-w-full rounded px-1.5 py-0.5 text-left text-xs ${chip.className}`}
    >
      <span className="line-clamp-2">{chip.text}</span>
    </button>
  );
}

export function TaskCard({
  map,
  task,
  phase,
  selectedId,
  dimmed,
  updated,
  expanded,
  onToggle,
  onSelect,
}: {
  map: WorkflowMap;
  task: MapTask;
  phase: MapPhase;
  selectedId: string | undefined;
  dimmed: boolean;
  updated: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const status = effectiveStatus(map, task);
  const subtasks = subtasksOf(map, task.id);
  const chips = buildChips(map, task.id);
  // 研究への影響（impact）は重要なので隠さない。つながり（flow）などはトグルで隠す
  const impactChips = chips.filter((c) => c.kind === "impact");
  const flowChips = chips.filter((c) => c.kind === "flow");
  const milestone = task.milestoneId
    ? map.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const unrecorded = task.flag === "unrecorded";
  const selected = selectedId === task.id;

  const hasHidden =
    subtasks.length > 0 ||
    flowChips.length > 0 ||
    Boolean(task.statusRaw) ||
    Boolean(task.result);
  const bodyId = `map-task-body-${task.id}`;
  const subtaskCounts = STATUS_ORDER.map((st) => ({
    status: st,
    count: subtasks.filter((s) => s.status === st).length,
  })).filter((c) => c.count > 0);

  const tone = unrecorded
    ? "border-amber-300 bg-amber-50"
    : "border-gray-200 bg-white";

  return (
    <li
      id={`map-task-${task.id}`}
      className={`relative scroll-mt-4 rounded-md border p-2.5 text-sm ${tone} ${
        selected ? "ring-2 ring-blue-500" : ""
      } ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1">
        {milestone && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${milestoneStyle(map, milestone.id)}`}
          >
            {milestone.title}
          </span>
        )}
        {unrecorded && (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900">
            記録のない実装
          </span>
        )}
        {updated && (
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white">
            更新
          </span>
        )}
        {task.review === "unconfirmed" && (
          <span className="rounded border border-amber-400 px-1.5 py-0.5 text-xs text-amber-800">
            未確認
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(task.id)}
        aria-pressed={selected}
        className="mt-1.5 block w-full rounded text-left font-medium text-gray-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {task.title}
      </button>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge label={statusLabel(phase, status)} status={status} />
        <span
          className="text-xs text-gray-500"
          title={STATUS_SOURCE_HINT[task.statusSource]}
        >
          {STATUS_SOURCE_LABEL[task.statusSource]}
        </span>
      </div>

      {task.purpose && (
        <p
          className="mt-1.5 line-clamp-1 text-xs text-gray-600"
          title={task.purpose}
        >
          {task.purpose}
        </p>
      )}

      {impactChips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {impactChips.map((c) => (
            <ChipButton key={c.key} chip={c} onSelect={onSelect} />
          ))}
        </div>
      )}

      {hasHidden && (
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="mt-1.5 flex w-full items-start gap-1 rounded px-1 py-0.5 text-left text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <span aria-hidden="true" className="shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="min-w-0 flex-1">
            {subtasks.length > 0 && (
              <span>
                サブタスク {subtasks.length}
                <span className="text-gray-500">
                  （
                  {subtaskCounts.map((c, i) => (
                    <span key={c.status}>
                      {i > 0 && " "}
                      <span
                        aria-hidden="true"
                        className={STATUS_ICON[c.status].className}
                      >
                        {STATUS_ICON[c.status].mark}
                      </span>
                      <span className="sr-only">
                        {statusLabel(phase, c.status)}
                      </span>
                      {c.count}
                    </span>
                  ))}
                  ）
                </span>
              </span>
            )}
            {subtasks.length > 0 && flowChips.length > 0 && "・"}
            {flowChips.length > 0 && <span>つながり {flowChips.length}</span>}
            {subtasks.length === 0 && flowChips.length === 0 && (
              <span>詳細（結果・元の状態）</span>
            )}
          </span>
        </button>
      )}

      <div id={bodyId} hidden={!expanded}>
        {task.statusRaw && (
          <p className="mt-1.5 text-xs text-gray-500">
            元の状態：
            <span className="font-mono text-gray-400">{task.statusRaw}</span>
          </p>
        )}
        {task.result && (
          <p className="mt-1 text-xs text-gray-500">結果：{task.result}</p>
        )}

        {subtasks.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-1.5">
            {subtasks.map((s) => {
              const icon = STATUS_ICON[s.status];
              const rejected = s.status === "rejected";
              const sSelected = selectedId === s.id;
              return (
                <li key={s.id} id={`map-task-${s.id}`} className="scroll-mt-4">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={sSelected}
                    className={`flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-gray-100 ${
                      sSelected ? "bg-blue-50 ring-1 ring-blue-400" : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-px shrink-0 ${icon.className}`}
                    >
                      {icon.mark}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={
                          rejected
                            ? "text-gray-400 line-through"
                            : "text-gray-800"
                        }
                      >
                        {s.title}
                      </span>
                      <span className="ml-1 text-gray-400">
                        （{statusLabel(phase, s.status)}）
                      </span>
                      {s.review === "unconfirmed" && (
                        <span className="ml-1 text-amber-700">未確認</span>
                      )}
                      {rejected && s.rejectReason && (
                        <span className="block text-gray-500">
                          理由：{s.rejectReason}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {flowChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-1.5">
            {flowChips.map((c) => (
              <ChipButton key={c.key} chip={c} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
