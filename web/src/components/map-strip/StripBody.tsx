"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  setStripOpen,
  setStripOrientation,
  useStripOpen,
} from "@/lib/map/prefs";
import {
  changedParentIds,
  currentFocus,
  phaseSummaries,
} from "@/lib/map/summary";
import { statusLabel, subtasksOf, unconfirmedCount } from "@/lib/map/view";
import type { MapStatus, WorkflowMap } from "@/lib/types";
import { STATUS_ICON, STATUS_ORDER } from "@/components/map/labels";
import { StripLane } from "./StripLane";

// マップがあるプロジェクトの帯。畳むと1段（約32px）、開くと小さなマップを出す（最大 min(30vh, 240px)）

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

  const summaries = useMemo(() => phaseSummaries(map), [map]);
  const { current, others } = useMemo(() => currentFocus(map), [map]);
  const focusIds = useMemo(() => new Set(current ? [current.id] : []), [current]);
  const changedIds = useMemo(() => new Set(changedParentIds(map)), [map]);
  const unconfirmed = unconfirmedCount(map);
  // サブタスクを持つタスク（親を持たないもの）の id
  const parentsWithSubs = useMemo(
    () =>
      map.tasks
        .filter((t) => !t.parentId && subtasksOf(map, t.id).length > 0)
        .map((t) => t.id),
    [map],
  );
  const allSubsOpen =
    parentsWithSubs.length > 0 && parentsWithSubs.every((id) => openSubs.has(id));

  const mapHref = `/themes/${encodeURIComponent(themeId)}/map`;

  function toggleSub(taskId: string) {
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleAllSubs() {
    setOpenSubs(allSubsOpen ? new Set() : new Set(parentsWithSubs));
  }

  // 「今ここ」は1件だけ出す（ほかに進行中・待ちのものはツールチップに）
  const focusTitle = current?.title ?? "";
  const currentPhaseName = map.phases.find((p) => p.id === current?.phaseId)?.name;
  const othersTitle =
    others.length > 0 ? `ほかに進行中・待ち：${others.map((t) => t.title).join(" / ")}` : undefined;

  return (
    <div
      className={`relative mx-auto max-w-screen-2xl ${
        open ? "max-h-[min(30vh,240px)] overflow-y-auto" : ""
      }`}
    >
      {/* 見出しの行。開いて中身をスクロールしても見えるよう、帯の中で固定する */}
      <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-paper px-4 sm:px-6 lg:px-8">
        <span className="shrink-0 font-serif text-xs font-semibold text-ink">
          <span className="hidden sm:inline">作業フローマップ</span>
          <span className="sm:hidden">マップ</span>
        </span>
        {!open ? (
          <ul
            aria-label="レーンごとの状態の件数"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {summaries.map((s) => {
              const parts = STATUS_ORDER.filter((st) => s.counts[st] > 0);
              const spoken = parts
                .map((st) => `${statusLabel(s.phase, st)} ${s.counts[st]}件`)
                .join("、");
              const isCurrent = s.phase.id === current?.phaseId;
              const label = `${spoken || "タスクなし"}${isCurrent ? "（今の段階）" : ""}`;
              return (
                <li
                  key={s.phase.id}
                  aria-label={`${s.phase.name}：${label}`}
                  title={label}
                  className={`shrink-0 border px-1.5 text-[13px] leading-5 ${
                    isCurrent
                      ? "border-ink text-ink"
                      : "border-hair text-ink-2"
                  }`}
                >
                  {isCurrent && (
                    <span
                      aria-hidden="true"
                      className="mr-1 bg-accent px-1 text-[12px] font-semibold text-paper"
                    >
                      今
                    </span>
                  )}
                  <span className="font-medium">{s.phase.name}</span>
                  {parts.map((st: MapStatus) => (
                    <span key={st} className="ml-1" aria-hidden="true">
                      <span className={STATUS_ICON[st].className}>
                        {STATUS_ICON[st].mark}
                      </span>
                      {s.counts[st]}
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="flex-1" />
        )}
        {focusTitle && (
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
        {unconfirmed > 0 && (
          <span
            className="marker shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium leading-5"
            title={`AI が作ったままで、まだ確認していないものが ${unconfirmed} 件あります`}
          >
            未確認 {unconfirmed}
            <span className="hidden sm:inline">件</span>
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {open && parentsWithSubs.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSubs}
              className={BUTTON}
              aria-label={`サブタスクをすべて${allSubsOpen ? "閉じる" : "開く"}`}
            >
              サブ{allSubsOpen ? "を閉じる" : "を開く"}
            </button>
          )}
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

      {open && (
        <div className="px-4 pb-1.5 sm:px-6 lg:px-8">
          <div className="overflow-x-auto">
            <div className="grid grid-flow-col auto-cols-[minmax(155px,1fr)] gap-1.5">
              {summaries.map((s) => (
                <StripLane
                  key={s.phase.id}
                  map={map}
                  themeId={themeId}
                  summary={s}
                  changedIds={changedIds}
                  focusIds={focusIds}
                  isCurrentPhase={s.phase.id === current?.phaseId}
                  openSubs={openSubs}
                  onToggleSub={toggleSub}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
