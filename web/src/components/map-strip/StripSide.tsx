"use client";

// 作業フローマップの帯（F-15）の縦の形：画面の右端に固定するサイドバー。
// 畳むと48px（いちばん上の開くボタン「«」だけ）。
// 開くと初期値208px（レーンの進み具合のステッププログレスバーだけ。幅は左端のつまみ SideResizeHandle で変えられる）。
// 開いた状態では、レーンをクリックするとその下にタスクを開き、タスクをクリックするとサブタスクを左に重ねて出す。
// 本文の右側を空けるのは親（MapStrip）がやる。

import Link from "next/link";
import { useMemo, useRef } from "react";
import {
  setStripOpen,
  setStripOrientation,
  useSideWidth,
  useStripOpen,
} from "@/lib/map/prefs";
import { currentFocus, phaseSummaries } from "@/lib/map/summary";
import type { WorkflowMap } from "@/lib/types";
import { SIDE_WIDTH } from "./sizes";
import { LaneStepper } from "./LaneStepper";
import { TaskPeek } from "./TaskPeek";
import { useLanePeek } from "./use-lane-peek";

// 開いた状態で、帯の左に重ねて出すタスクのサブタスクの幅（px）
const PEEK_WIDTH = 288;

const BUTTON =
  "border border-ink bg-paper px-1.5 py-0.5 text-[13px] leading-4 text-ink hover:bg-paper-2";

export function StripSide({
  themeId,
  map,
}: {
  themeId: string;
  map: WorkflowMap;
}) {
  const open = useStripOpen();
  const openWidth = useSideWidth();
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
  // 重ねて出すのは、開いた状態でクリックしたタスク
  const peekTask = open ? map.tasks.find((t) => t.id === peek.shown) : undefined;
  const peekTaskPhase = peekTask && map.phases.find((p) => p.id === peekTask.phaseId);

  const mapHref = `/themes/${encodeURIComponent(themeId)}/map`;

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
        // 畳んだ状態は、開くボタンだけ
        <div className="px-1 py-2">
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

