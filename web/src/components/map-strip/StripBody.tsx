"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  setStripOpen,
  setStripOrientation,
  useStripOpen,
} from "@/lib/map/prefs";
import {
  changedParentIds,
  currentFocus,
  phaseSummaries,
  progressText,
} from "@/lib/map/summary";
import { statusLabel, unconfirmedCount } from "@/lib/map/view";
import type { WorkflowMap } from "@/lib/types";
import { STATUS_ORDER } from "@/components/map/labels";
import { StripLane } from "./StripLane";
import { useLanePeek } from "./use-lane-peek";

// マップがあるプロジェクトの帯。1段（約32px）で、レーン名と進み具合（サブタスクの済み/全体）だけを並べる。開いた状態では、今ここと未確認の件数も出す。
// レーンをクリックすると、そのレーンの中身を帯の下に重ねて出す（マウスを合わせただけでは開かない）

// 重ねて出すレーンの中身の幅（px）
const PEEK_WIDTH = 320;

// display を含めない部分。hidden と組み合わせるボタンで display がぶつからないようにする
const BUTTON_BASE =
  "shrink-0 items-center whitespace-nowrap border border-ink bg-paper px-1.5 py-px text-[13px] leading-5 text-ink hover:bg-paper-2";
const BUTTON = `inline-flex ${BUTTON_BASE}`;

export function StripBody({
  themeId,
  map,
}: {
  themeId: string;
  map: WorkflowMap;
}) {
  const open = useStripOpen();
  const [openSubs, setOpenSubs] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const peek = useLanePeek(rootRef);

  // 重ねる中身は、札の左端にそろえる（帯からはみ出さないよう右端で止める）
  function peekLeft(chip: HTMLElement): number {
    const root = rootRef.current;
    if (!root) return 0;
    const rootBox = root.getBoundingClientRect();
    const left = chip.getBoundingClientRect().left - rootBox.left;
    return Math.max(0, Math.min(left, rootBox.width - PEEK_WIDTH));
  }

  const summaries = useMemo(() => phaseSummaries(map), [map]);
  const peekSummary = summaries.find((s) => s.phase.id === peek.shown);
  const { current, others } = useMemo(() => currentFocus(map), [map]);
  const focusIds = useMemo(() => new Set(current ? [current.id] : []), [current]);
  const changedIds = useMemo(() => new Set(changedParentIds(map)), [map]);
  const unconfirmed = unconfirmedCount(map);

  const mapHref = `/themes/${encodeURIComponent(themeId)}/map`;

  function toggleSub(taskId: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // 「今ここ」は1件だけ出す（ほかに進行中・待ちのものはツールチップに）
  const focusTitle = current?.title ?? "";
  const currentPhaseName = map.phases.find((p) => p.id === current?.phaseId)?.name;
  const othersTitle =
    others.length > 0 ? `ほかに進行中・待ち：${others.map((t) => t.title).join(" / ")}` : undefined;

  return (
    <div
      ref={rootRef}
      className="relative mx-auto max-w-screen-2xl"
    >
      {/* 1段だけの行。開いた状態では、今ここと未確認の件数も出す */}
      <div className="flex h-8 items-center gap-2 bg-paper px-4 sm:px-6 lg:px-8">
        <span className="shrink-0 font-serif text-xs font-semibold text-ink">
          <span className="hidden sm:inline">作業フローマップ</span>
          <span className="sm:hidden">マップ</span>
        </span>
        <ul
          aria-label="レーンごとの進み具合"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {summaries.map((s) => {
            const spoken = STATUS_ORDER.filter((st) => s.counts[st] > 0)
              .map((st) => `${statusLabel(s.phase, st)} ${s.counts[st]}件`)
              .join("、");
            const isCurrent = s.phase.id === current?.phaseId;
            const isOpen = peek.shown === s.phase.id;
            const progress = progressText(s);
            return (
              <li key={s.phase.id} className="shrink-0">
                <button
                  type="button"
                  onClick={(e) => peek.toggle(s.phase.id, peekLeft(e.currentTarget))}
                  aria-expanded={isOpen}
                  aria-controls="map-strip-peek"
                  aria-label={`${s.phase.name}：進み具合 ${progress}${isCurrent ? "（今の段階）" : ""}。${spoken || "タスクなし"}`}
                  className={`border px-1.5 text-[13px] leading-5 hover:bg-paper-2 ${
                    isOpen
                      ? "border-ink bg-paper-2 text-ink"
                      : isCurrent
                        ? "border-accent bg-accent-soft font-semibold text-accent-deep"
                        : "border-hair text-ink-2"
                  }`}
                >
                  <span className="font-medium">{s.phase.name}</span>
                  <span aria-hidden="true" className="ml-1 font-mono tabular-nums">
                    {progress}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {open && focusTitle && (
          <span
            className="hidden min-w-0 max-w-[20rem] shrink items-center text-[13px] text-ink-2 md:flex"
            title={othersTitle ? `${focusTitle}\n${othersTitle}` : focusTitle}
          >
            {/* 工程の札がはみ出しても今の段階が分かるよう、ここにも工程名を出す */}
            {currentPhaseName && (
              <span className="mr-1 shrink-0 bg-accent px-1.5 font-semibold leading-5 text-paper">
                今は{currentPhaseName}
              </span>
            )}
            <span className="shrink-0 font-semibold text-ink">今ここ：</span>
            <span className="min-w-0 truncate">{focusTitle}</span>
            {/* 件数はタイトルが省略されても見えるよう、外に出す */}
            {others.length > 0 && (
              <span className="ml-1 shrink-0 text-ink-3">ほか {others.length} 件</span>
            )}
          </span>
        )}
        {open && unconfirmed > 0 && (
          <span
            className="marker shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium leading-5"
            title={`AI が作ったままで、まだ確認していないものが ${unconfirmed} 件あります`}
          >
            未確認 {unconfirmed}
            <span className="hidden sm:inline">件</span>
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setStripOrientation("vertical")}
            aria-label="マップの帯を右側に縦に並べる"
            title="マップの帯を右側に縦に並べる"
            className={`${BUTTON_BASE} hidden md:inline-flex`}
          >
            縦にする
          </button>
          <button
            type="button"
            onClick={() => setStripOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "マップの帯を畳む" : "マップの帯を開く"}
            className={BUTTON}
          >
            {open ? "畳む" : "開く"}
          </button>
          <Link
            href={mapHref}
            aria-label="作業フローマップの画面を開く"
            className={`${BUTTON} font-semibold`}
          >
            <span className="hidden sm:inline">マップを開く</span>
            <span className="sm:hidden">詳細</span>
          </Link>
        </div>
      </div>

      {/* クリックしたレーンの中身を、帯の下に重ねて出す */}
      {peekSummary && (
        <div
          id="map-strip-peek"
          style={{ left: peek.pos, width: PEEK_WIDTH }}
          className="absolute top-full z-40 max-h-[60vh] overflow-y-auto border border-ink bg-paper shadow-sm"
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
    </div>
  );
}
