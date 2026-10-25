"use client";

// 作業フローマップの帯（F-15）の縦の形：画面の右端に固定するサイドバー。
// 畳むと48px（レーンの頭文字と進み具合だけ。レーンをクリックするとそのレーンの中身を左に重ねて出す）。
// 開くと初期値208px（レーンの進み具合のステッププログレスバーだけ。幅は左端のつまみ SideResizeHandle で変えられる）。
// 開いた状態では、レーンをクリックするとその下にタスクを開き、タスクをクリックするとサブタスクを左に重ねて出す。
// 本文の右側を空けるのは親（MapStrip）がやる。

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  setStripOpen,
  setStripOrientation,
  useSideWidth,
  useStripOpen,
} from "@/lib/map/prefs";
import {
  changedParentIds,
  currentFocus,
  phaseSummaries,
  progressText,
} from "@/lib/map/summary";
import { statusLabel } from "@/lib/map/view";
import type { WorkflowMap } from "@/lib/types";
import { STATUS_ORDER } from "@/components/map/labels";
import { SIDE_WIDTH } from "./sizes";
import { LaneStepper } from "./LaneStepper";
import { StripLane } from "./StripLane";
import { TaskPeek } from "./TaskPeek";
import { useLanePeek } from "./use-lane-peek";

// 帯の左に重ねて出す中身（畳んだ状態はレーン、開いた状態はタスクのサブタスク）の幅（px）
const PEEK_WIDTH = 288;

const BUTTON =
  "border border-ink bg-paper px-1.5 py-0.5 text-[13px] leading-4 text-ink hover:bg-paper-2";

const SMALL_BUTTON =
  "w-full border border-ink bg-paper py-1 text-[12px] leading-tight text-ink hover:bg-paper-2";

export function StripSide({
  themeId,
  map,
}: {
  themeId: string;
  map: WorkflowMap;
}) {
  const open = useStripOpen();
  const openWidth = useSideWidth();
  const [openSubs, setOpenSubs] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLElement>(null);
  const peek = useLanePeek(rootRef);

  // 重ねる中身は、札の上端にそろえる（画面の下からはみ出しにくいよう、下の方では上にずらす）
  function peekTop(chip: HTMLElement): number {
    const top = chip.getBoundingClientRect().top;
    return Math.max(8, Math.min(top, window.innerHeight * 0.3));
  }

  const summaries = useMemo(() => phaseSummaries(map), [map]);
  const { current } = useMemo(() => currentFocus(map), [map]);
  const focusIds = useMemo(() => new Set(current ? [current.id] : []), [current]);
  const changedIds = useMemo(() => new Set(changedParentIds(map)), [map]);
  // 重ねて出すのは、畳んだ状態ではクリックしたレーン、開いた状態ではクリックしたタスク
  const peekSummary = open ? undefined : summaries.find((s) => s.phase.id === peek.shown);
  const peekTask = open ? map.tasks.find((t) => t.id === peek.shown) : undefined;
  const peekTaskPhase = peekTask && map.phases.find((p) => p.id === peekTask.phaseId);

  const mapHref = `/themes/${encodeURIComponent(themeId)}/map`;

  function toggleSub(taskId: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  const width = open ? openWidth : SIDE_WIDTH.collapsed;

  return (
    <aside
      ref={rootRef}
      aria-label="作業フローマップ"
      style={{ width }}
      className="fixed inset-y-0 right-0 z-30 overflow-y-auto overflow-x-hidden border-l border-hair bg-paper"
    >
      {open ? (
        <div className="px-2 py-2">
          <span className="block font-serif text-xs font-semibold leading-tight text-ink">
            作業フローマップ
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setStripOpen(false)}
              aria-expanded={true}
              aria-label="作業フローマップを畳む"
              className={BUTTON}
            >
              畳む »
            </button>
            <button
              type="button"
              onClick={() => setStripOrientation("horizontal")}
              aria-label="作業フローマップを上の横の帯にする"
              className={BUTTON}
            >
              横にする
            </button>
            <Link href={mapHref} className={`${BUTTON} font-semibold`}>
              マップを開く
            </Link>
          </div>

          <LaneStepper
            map={map}
            summaries={summaries}
            currentPhaseId={current?.phaseId}
            focusIds={focusIds}
            shownTaskId={peekTask ? peekTask.id : null}
            onTaskClick={(id, el) => peek.toggle(id, peekTop(el))}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-1 py-2">
          <button
            type="button"
            onClick={() => setStripOpen(true)}
            aria-expanded={false}
            aria-label="作業フローマップを開く"
            title="作業フローマップを開く"
            className="w-full border border-ink bg-paper py-1 text-sm leading-none text-ink hover:bg-paper-2"
          >
            «
          </button>

          <ul
            aria-label="レーンごとの進み具合"
            className="w-full space-y-1"
          >
            {summaries.map((s) => {
              const spoken = STATUS_ORDER.filter((st) => s.counts[st] > 0)
                .map((st) => `${statusLabel(s.phase, st)} ${s.counts[st]}件`)
                .join("、");
              const hasFocus = s.phase.id === current?.phaseId;
              const isOpen = peek.shown === s.phase.id;
              const progress = progressText(s);
              return (
                <li key={s.phase.id}>
                  <button
                    type="button"
                    onClick={(e) => peek.toggle(s.phase.id, peekTop(e.currentTarget))}
                    aria-expanded={isOpen}
                    aria-controls="map-side-peek"
                    aria-label={`${s.phase.name}：進み具合 ${progress}${hasFocus ? "（今の段階）" : ""}。${spoken || "タスクなし"}`}
                    className={`flex w-full flex-col items-center border px-0.5 py-1 hover:bg-paper-2 ${
                      isOpen
                        ? "border-ink bg-paper-2 text-ink"
                        : hasFocus
                          ? "border-accent bg-accent-soft text-accent-deep ring-1 ring-accent"
                          : "border-hair text-ink-2"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="text-[13px] font-semibold leading-tight"
                    >
                      {s.phase.name.slice(0, 1)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-mono text-[11px] leading-tight tabular-nums"
                    >
                      {progress}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Link
            href={mapHref}
            aria-label="マップを開く"
            title="マップを開く"
            className={`${SMALL_BUTTON} text-center font-semibold`}
          >
            マップ
          </Link>
          <button
            type="button"
            onClick={() => setStripOrientation("horizontal")}
            aria-label="作業フローマップを上の横の帯にする"
            title="横の帯にする"
            className={SMALL_BUTTON}
          >
            横へ
          </button>
        </div>
      )}

      {/* 畳んだ状態で、クリックしたレーンの中身を、帯の左に重ねて出す */}
      {peekSummary && (
        <div
          id="map-side-peek"
          style={{ top: peek.pos, right: width, width: PEEK_WIDTH }}
          className="fixed z-40 max-h-[70vh] overflow-y-auto border border-ink bg-paper shadow-sm"
        >
          <StripLane
            map={map}
            themeId={themeId}
            summary={peekSummary}
            changedIds={changedIds}
            focusIds={focusIds}
            isCurrentPhase={peekSummary.phase.id === current?.phaseId}
            openSubs={openSubs}
            onToggleSub={toggleSub}
          />
        </div>
      )}

      {/* 開いた状態で、クリックしたタスクのサブタスクを、帯の左に重ねて出す */}
      {peekTask && peekTaskPhase && (
        <div
          id="map-side-peek"
          style={{ top: peek.pos, right: width, width: PEEK_WIDTH }}
          className="fixed z-40 max-h-[70vh] overflow-y-auto border border-ink bg-paper shadow-sm"
        >
          <TaskPeek map={map} themeId={themeId} task={peekTask} phase={peekTaskPhase} />
        </div>
      )}
    </aside>
  );
}

