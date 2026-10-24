"use client";

// 作業フローマップの帯（F-15）の縦の形：画面の右端に固定するサイドバー。
// 畳むと48px（レーンの頭文字と件数だけ）、開くと208px（小さなマップ）。
// 本文の右側を空けるのは親（MapStrip）がやる。

import Link from "next/link";
import { useMemo, useState } from "react";
import { setStripOpen, setStripOrientation, useStripOpen } from "@/lib/map/prefs";
import {
  changedParentIds,
  focusTasks,
  phaseSummaries,
} from "@/lib/map/summary";
import { statusLabel, subtasksOf, unconfirmedCount } from "@/lib/map/view";
import type { MapStatus, WorkflowMap } from "@/lib/types";
import { STATUS_ICON, STATUS_ORDER } from "@/components/map/labels";
import { SideLane } from "./SideLane";
import { SIDE_WIDTH } from "./sizes";

const BUTTON =
  "rounded border border-gray-300 px-1.5 py-0.5 text-[11px] leading-4 text-gray-700 hover:bg-gray-50";

const SMALL_BUTTON =
  "w-full rounded border border-gray-300 py-1 text-[10px] leading-tight text-gray-700 hover:bg-gray-50";

export function StripSide({
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

  const width = open ? SIDE_WIDTH.open : SIDE_WIDTH.collapsed;

  return (
    <aside
      aria-label="作業フローマップ"
      style={{ width }}
      className="fixed inset-y-0 right-0 z-30 overflow-y-auto overflow-x-hidden border-l border-gray-200 bg-white"
    >
      {open ? (
        <div className="px-2 py-2">
          <span className="block text-xs font-semibold leading-tight text-gray-800">
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
            <Link href={mapHref} className={`${BUTTON} text-blue-700`}>
              マップを開く
            </Link>
          </div>

          {unconfirmed > 0 && (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-800">
              未確認 {unconfirmed} 件（AI が作ったままで、まだ確認していません）
            </p>
          )}

          {focus.length > 0 && (
            <section aria-label="今ここ" className="mt-1.5">
              <h2 className="text-[11px] font-semibold text-indigo-700">
                今ここ
              </h2>
              <ul className="mt-0.5 space-y-0.5">
                {focus.map((t) => (
                  <li key={t.id} className="min-w-0 text-[11px] leading-snug">
                    <Link
                      href={`${mapHref}?task=${encodeURIComponent(t.id)}`}
                      className="break-words text-gray-900 hover:underline"
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parentsWithSubs.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSubs}
              className={`${BUTTON} mt-2 w-full`}
            >
              サブタスクをすべて{allSubsOpen ? "閉じる" : "開く"}
            </button>
          )}

          <div className="mt-2 space-y-1.5 pb-2">
            {summaries.map((s) => (
              <SideLane
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
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-1 py-2">
          <button
            type="button"
            onClick={() => setStripOpen(true)}
            aria-expanded={false}
            aria-label="作業フローマップを開く"
            title="作業フローマップを開く"
            className="w-full rounded border border-gray-300 py-1 text-sm leading-none text-gray-700 hover:bg-gray-50"
          >
            «
          </button>

          <ul aria-label="レーンごとの状態の件数" className="w-full space-y-1">
            {summaries.map((s) => {
              const parts = STATUS_ORDER.filter((st) => s.counts[st] > 0);
              const spoken = parts
                .map((st) => `${statusLabel(s.phase, st)} ${s.counts[st]}件`)
                .join("、");
              const hasFocus = s.focus.length > 0;
              const text = `${spoken || "タスクなし"}${hasFocus ? "（今ここあり）" : ""}`;
              return (
                <li
                  key={s.phase.id}
                  title={`${s.phase.name}：${text}`}
                  aria-label={`${s.phase.name}：${text}`}
                  className="flex flex-col items-center rounded bg-gray-100 px-0.5 py-1 text-gray-700"
                >
                  <span
                    aria-hidden="true"
                    className="flex items-center gap-px text-[11px] font-semibold leading-tight"
                  >
                    {s.phase.name.slice(0, 1)}
                    {hasFocus && (
                      <span className="text-[8px] leading-none text-indigo-600">
                        ●
                      </span>
                    )}
                  </span>
                  {parts.map((st: MapStatus) => (
                    <span
                      key={st}
                      aria-hidden="true"
                      className="text-[10px] leading-tight"
                    >
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

          {unconfirmed > 0 && (
            <span
              title={`未確認 ${unconfirmed}件`}
              aria-label={`未確認 ${unconfirmed}件`}
              className="rounded bg-amber-100 px-1 text-[10px] font-medium leading-4 text-amber-800"
            >
              <span aria-hidden="true">
                未{unconfirmed > 99 ? "99+" : unconfirmed}
              </span>
            </span>
          )}

          <Link
            href={mapHref}
            aria-label="マップを開く"
            title="マップを開く"
            className={`${SMALL_BUTTON} text-center text-blue-700`}
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
    </aside>
  );
}
