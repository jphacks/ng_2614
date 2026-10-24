"use client";

// 作業フローマップの帯（F-15）の縦の形：画面の右端に固定するサイドバー。
// 畳むと48px（レーンの頭文字と件数だけ）、開くと208px（小さなマップ）。
// 本文の右側を空けるのは親（MapStrip）がやる。

import Link from "next/link";
import { useMemo, useState } from "react";
import { setStripOpen, setStripOrientation, useStripOpen } from "@/lib/map/prefs";
import {
  changedParentIds,
  currentFocus,
  phaseSummaries,
  type CurrentFocusReason,
} from "@/lib/map/summary";
import { effectiveStatus, statusLabel, subtasksOf, unconfirmedCount } from "@/lib/map/view";
import type { MapPhase, MapStatus, MapTask, WorkflowMap } from "@/lib/types";
import { STATUS_BADGE, STATUS_ICON, STATUS_ORDER } from "@/components/map/labels";
import { SideLane } from "./SideLane";
import { SIDE_WIDTH } from "./sizes";

const BUTTON =
  "rounded border border-gray-300 px-1.5 py-0.5 text-[11px] leading-4 text-gray-700 hover:bg-gray-50";

// 今ここをどう選んだか（lib/map/summary.ts の currentFocus）
const REASON_TEXT: Record<CurrentFocusReason, string> = {
  update: "直近の更新で変わったタスク",
  record: "いちばん新しい記録のタスク",
  order: "進行中・待ちのうち、工程の順で最初のタスク",
};

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
  const { current, reason, others } = useMemo(() => currentFocus(map), [map]);
  const focusIds = useMemo(() => new Set(current ? [current.id] : []), [current]);
  const phaseById = useMemo(() => new Map(map.phases.map((p) => [p.id, p])), [map]);
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

          {/* 今ここは1件だけ、いちばん上に囲みで出す。ほかの進行中・待ちはその下に区切って並べる */}
          {current && (
            <section
              aria-label="今ここ"
              className="mt-2 rounded-md border border-indigo-200 bg-indigo-50 p-1.5"
            >
              <h2 className="text-xs font-semibold text-indigo-800">今ここ</h2>
              <FocusLink
                href={`${mapHref}?task=${encodeURIComponent(current.id)}`}
                task={current}
                phase={phaseById.get(current.phaseId)}
                status={effectiveStatus(map, current)}
                strong
              />
              {reason && (
                <p className="mt-0.5 text-[10px] leading-snug text-indigo-700">
                  {REASON_TEXT[reason]}
                </p>
              )}
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="ほかに進行中・待ち" className="mt-1.5 px-0.5">
              <h2 className="flex items-baseline justify-between text-[11px] font-semibold text-gray-700">
                ほかに進行中・待ち
                <span className="text-[10px] font-normal text-gray-500">
                  {others.length} 件
                </span>
              </h2>
              <ul className="mt-0.5 divide-y divide-gray-200">
                {others.map((t) => (
                  <li key={t.id} className="min-w-0 py-1 last:pb-0">
                    <FocusLink
                      href={`${mapHref}?task=${encodeURIComponent(t.id)}`}
                      task={t}
                      phase={phaseById.get(t.phaseId)}
                      status={effectiveStatus(map, t)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unconfirmed > 0 && (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-800">
              未確認 {unconfirmed} 件（AI が作ったままで、まだ確認していません）
            </p>
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
              const hasFocus = s.phase.id === current?.phaseId;
              const text = `${spoken || "タスクなし"}${hasFocus ? "（今ここあり）" : ""}`;
              return (
                <li
                  key={s.phase.id}
                  title={`${s.phase.name}：${text}`}
                  aria-label={`${s.phase.name}：${text}`}
                  className={`flex flex-col items-center rounded px-0.5 py-1 ${
                    hasFocus
                      ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300"
                      : "bg-gray-100 text-gray-700"
                  }`}
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

// 今ここ・ほかに進行中・待ちの1件。レーン名と状態を添え、S-7 のそのタスクへ飛ぶ
function FocusLink({
  href,
  task,
  phase,
  status,
  strong = false,
}: {
  href: string;
  task: MapTask;
  phase: MapPhase | undefined;
  status: MapStatus;
  strong?: boolean;
}) {
  return (
    <Link href={href} className="group mt-0.5 block">
      <span className="flex flex-wrap items-center gap-1 text-[10px] leading-4 text-gray-600">
        {phase?.name}
        {phase && (
          <span className={`rounded px-1 font-medium ${STATUS_BADGE[status]}`}>
            {statusLabel(phase, status)}
          </span>
        )}
      </span>
      <span
        className={`block break-words leading-snug group-hover:underline ${
          strong ? "text-xs font-medium text-gray-900" : "text-[11px] text-gray-800"
        }`}
      >
        {task.title}
      </span>
    </Link>
  );
}
