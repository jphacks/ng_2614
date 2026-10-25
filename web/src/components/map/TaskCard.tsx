"use client";

import type { MapLink, MapPhase, MapTask, WorkflowMap } from "@/lib/types";
import {
  effectiveStatus,
  linksOf,
  statusLabel,
  subtasksOf,
} from "@/lib/map/view";
import { milestoneStyle, STATUS_ICON } from "./labels";
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
  const flow = "border border-hair text-ink-2 hover:bg-paper-2";
  const impact = "border border-pen text-pen hover:bg-pen-soft";
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
      className={`max-w-full px-1.5 py-0.5 text-left text-xs ${chip.className}`}
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
  const impactChips = chips.filter((c) => c.kind === "impact");
  const flowChips = chips.filter((c) => c.kind === "flow");
  const milestone = task.milestoneId
    ? map.milestones.find((m) => m.id === task.milestoneId)
    : undefined;
  const unrecorded = task.flag === "unrecorded";
  const selected = selectedId === task.id;
  const bodyId = `map-task-body-${task.id}`;
  const icon = STATUS_ICON[status];
  // サブタスクの進み具合（不採用は数えない）
  const counted = subtasks.filter((s) => s.status !== "rejected");
  const countedDone = counted.filter((s) => s.status === "done").length;

  const tone = unrecorded
    ? "border-dashed border-ink-3 bg-paper"
    : "border-hair bg-sheet";

  return (
    <li
      id={`map-task-${task.id}`}
      className={`relative scroll-mt-4 rounded-[4px] border text-sm ${tone} ${
        selected ? "ring-2 ring-accent" : ""
      } ${dimmed ? "opacity-40" : ""}`}
    >
      {/* カードはタイトルだけ。クリックで、サブタスクとそのほかの中身を下に開く */}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={`${task.title}（${statusLabel(phase, status)}${counted.length > 0 ? `、サブタスク ${countedDone}/${counted.length}` : ""}）`}
        className="flex w-full items-start gap-1.5 p-2 text-left hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-xs text-ink-3">
          {expanded ? "▾" : "▸"}
        </span>
        <span aria-hidden="true" className={`shrink-0 ${icon.className}`}>
          {icon.mark}
        </span>
        {/* 閉じたカードの高さをそろえるため、タイトルは2行分の高さにし、はみ出す分は省略する（開いたら全部出す） */}
        <span
          title={task.title}
          className={`min-h-[2lh] min-w-0 flex-1 font-medium leading-snug text-ink ${expanded ? "" : "line-clamp-2"}`}
        >
          {task.title}
        </span>
        {counted.length > 0 && (
          <span aria-hidden="true" className="shrink-0 font-mono text-xs tabular-nums text-ink-3">
            {countedDone}/{counted.length}
          </span>
        )}
      </button>

      <div id={bodyId} hidden={!expanded} className="border-t border-hair px-2.5 pb-2.5 pt-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge label={statusLabel(phase, status)} status={status} />
          {milestone && (
            <span
              title={milestone.title}
              className={`tag max-w-full truncate ${milestoneStyle(map, milestone.id)}`}
            >
              {milestone.title}
            </span>
          )}
          {unrecorded && (
            <span className="marker py-0.5 text-xs font-medium">記録のない実装</span>
          )}
          {updated && <span className="tag text-ink">更新</span>}
          {task.review === "unconfirmed" && (
            <span className="marker py-0.5 text-xs">未確認</span>
          )}
        </div>

        {task.purpose && <p className="mt-1.5 text-xs text-ink-2">{task.purpose}</p>}

        {impactChips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {impactChips.map((c) => (
              <ChipButton key={c.key} chip={c} onSelect={onSelect} />
            ))}
          </div>
        )}

        {task.statusRaw && (
          <p className="mt-1.5 text-xs text-ink-3">
            元の状態：
            <span className="font-mono text-ink-3">{task.statusRaw}</span>
          </p>
        )}
        {task.result && (
          <p className="mt-1 text-xs text-ink-2">結果：{task.result}</p>
        )}

        {subtasks.length > 0 && (
          <ul aria-label="サブタスク" className="mt-2 space-y-0.5 border-t border-hair pt-1.5">
            {subtasks.map((s) => {
              const sIcon = STATUS_ICON[s.status];
              const rejected = s.status === "rejected";
              const sSelected = selectedId === s.id;
              return (
                <li key={s.id} id={`map-task-${s.id}`} className="scroll-mt-4">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={sSelected}
                    className={`flex w-full items-start gap-1.5 px-1 py-0.5 text-left text-xs hover:bg-paper-2 ${
                      sSelected ? "bg-accent-soft ring-1 ring-accent" : ""
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-px shrink-0 ${sIcon.className}`}
                    >
                      {sIcon.mark}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={
                          rejected
                            ? "text-ink-3 line-through"
                            : "text-ink"
                        }
                      >
                        {s.title}
                      </span>
                      <span className="ml-1 text-ink-3">
                        （{statusLabel(phase, s.status)}）
                      </span>
                      {s.review === "unconfirmed" && (
                        <span className="marker ml-1">未確認</span>
                      )}
                      {rejected && s.rejectReason && (
                        <span className="block text-ink-3">
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
          <div className="mt-2 flex flex-wrap gap-1 border-t border-hair pt-1.5">
            {flowChips.map((c) => (
              <ChipButton key={c.key} chip={c} onSelect={onSelect} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onSelect(task.id)}
          aria-pressed={selected}
          className="link mt-2 text-xs"
        >
          詳細を見る
        </button>
      </div>
    </li>
  );
}
