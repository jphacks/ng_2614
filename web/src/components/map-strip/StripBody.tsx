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
  focusTasks,
  phaseSummaries,
} from "@/lib/map/summary";
import { statusLabel, subtasksOf, unconfirmedCount } from "@/lib/map/view";
import type { MapStatus, WorkflowMap } from "@/lib/types";
import { STATUS_ICON, STATUS_ORDER } from "@/components/map/labels";
import { StripLane } from "./StripLane";

// マップがあるプロジェクトの帯。畳むと1段（約32px）、開くと小さなマップを出す（最大 min(30vh, 240px)）

// display を含めない部分。hidden と組み合わせるボタンで display がぶつからないようにする
const BUTTON_BASE =
  "shrink-0 items-center whitespace-nowrap rounded border border-gray-300 px-1.5 py-px text-[11px] leading-5 text-gray-700 hover:bg-gray-50";
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
  const focus = useMemo(() => focusTasks(map), [map]);
  const focusIds = useMemo(() => new Set(focus.map((t) => t.id)), [focus]);
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

  // 「今ここ」は1件だけ出す（全件はツールチップに）
  const focusFirst = focus[0]?.title ?? "";
  const focusAll = focus.map((t) => t.title).join(" / ");

  return (
    <div
      className={`relative mx-auto max-w-4xl ${
        open ? "max-h-[min(30vh,240px)] overflow-y-auto" : ""
      }`}
    >
      {/* 見出しの行。開いて中身をスクロールしても見えるよう、帯の中で固定する */}
      <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-white px-3 sm:px-4">
        <span className="shrink-0 text-xs font-semibold text-gray-800">
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
              return (
                <li
                  key={s.phase.id}
                  aria-label={`${s.phase.name}：${spoken || "タスクなし"}`}
                  title={spoken || "タスクなし"}
                  className="shrink-0 rounded-full bg-gray-100 px-1.5 text-[11px] leading-5 text-gray-700"
                >
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
        {!open && focusFirst && (
          <span
            className="hidden min-w-0 max-w-[16rem] shrink truncate text-[11px] text-gray-600 md:block"
            title={focusAll}
          >
            <span className="font-medium text-indigo-700">今ここ：</span>
            {focusFirst}
          </span>
        )}
        {unconfirmed > 0 && (
          <span
            className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 text-[11px] font-medium leading-5 text-amber-800"
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
            className={`${BUTTON} text-blue-700`}
          >
            <span className="hidden sm:inline">マップを開く</span>
            <span className="sm:hidden">詳細</span>
          </Link>
        </div>
      </div>

      {open && (
        <div className="px-3 pb-1.5 sm:px-4">
          {unconfirmed > 0 && (
            <p className="mb-1 text-[11px] text-amber-800">
              AI が作ったままで、まだ確認していないものが {unconfirmed} 件あります。
            </p>
          )}
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
