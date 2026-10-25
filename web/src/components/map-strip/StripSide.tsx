"use client";

// 作業フローマップの帯（F-15）の縦の形：画面の右端に固定するサイドバー。
// 畳むと48px（レーンの頭文字と件数だけ）、開くと初期値208px（小さなマップ。幅は左端のつまみ SideResizeHandle で変えられる）。
// 本文の右側を空けるのは親（MapStrip）がやる。

import Link from "next/link";
import { useMemo, useState } from "react";
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
} from "@/lib/map/summary";
import { effectiveStatus, statusLabel, subtasksOf, unconfirmedCount } from "@/lib/map/view";
import type { MapPhase, MapStatus, MapTask, WorkflowMap } from "@/lib/types";
import {
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_ORDER,
} from "@/components/map/labels";
import { PhaseSteps } from "@/components/map/PhaseSteps";
import { SideLane } from "./SideLane";
import { SIDE_WIDTH } from "./sizes";

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

  const summaries = useMemo(() => phaseSummaries(map), [map]);
  const { current, others } = useMemo(() => currentFocus(map), [map]);
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

  const width = open ? openWidth : SIDE_WIDTH.collapsed;

  return (
    <aside
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

          {/* 今の段階と今ここ（1件）を、いちばん上に囲みで出す。ほかの進行中・待ちはその下に区切って並べる */}
          {current && (
            <section
              aria-label="今の段階と今ここ"
              className="mt-2 border-2 border-accent bg-paper p-1.5"
            >
              <p className="font-serif text-sm font-bold leading-snug text-ink">
                今は「{phaseById.get(current.phaseId)?.name}」の段階
              </p>
              <div className="mt-1">
                <PhaseSteps map={map} currentPhaseId={current.phaseId} size="sm" />
              </div>
              <h2 className="mt-1.5 inline-block bg-accent px-1 text-xs font-semibold text-paper">今ここ</h2>
              <FocusLink
                href={`${mapHref}?task=${encodeURIComponent(current.id)}`}
                task={current}
                phase={phaseById.get(current.phaseId)}
                status={effectiveStatus(map, current)}
                strong
              />
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="ほかに進行中・待ち" className="mt-1.5 px-0.5">
              <h2 className="flex items-baseline justify-between text-[13px] font-semibold text-ink-2">
                ほかに進行中・待ち
                <span className="text-[12px] font-normal text-ink-3">
                  {others.length} 件
                </span>
              </h2>
              <ul className="mt-0.5 divide-y divide-hair">
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
            <p className="marker mt-1.5 w-fit text-[13px] leading-snug">
              未確認 {unconfirmed} 件
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
                isCurrentPhase={s.phase.id === current?.phaseId}
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
            className="w-full border border-ink bg-paper py-1 text-sm leading-none text-ink hover:bg-paper-2"
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
              const text = `${spoken || "タスクなし"}${hasFocus ? "（今の段階）" : ""}`;
              return (
                <li
                  key={s.phase.id}
                  title={`${s.phase.name}：${text}`}
                  aria-label={`${s.phase.name}：${text}`}
                  className={`flex flex-col items-center border px-0.5 py-1 ${
                    hasFocus
                      ? "border-accent text-ink ring-1 ring-accent"
                      : "border-hair text-ink-2"
                  }`}
                >
                  {hasFocus && (
                    <span
                      aria-hidden="true"
                      className="bg-accent px-1 text-[11px] font-semibold leading-3 text-paper"
                    >
                      今
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="text-[13px] font-semibold leading-tight"
                  >
                    {s.phase.name.slice(0, 1)}
                  </span>
                  {parts.map((st: MapStatus) => (
                    <span
                      key={st}
                      aria-hidden="true"
                      className="text-[12px] leading-tight"
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
              className="marker text-[12px] font-medium leading-4"
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
      <span className="flex flex-wrap items-center gap-1 text-[12px] leading-4 text-ink-2">
        {phase?.name}
        {phase && (
          <span className={`tag px-1 text-[12px] leading-4 ${STATUS_BADGE[status]}`}>
            {statusLabel(phase, status)}
          </span>
        )}
      </span>
      <span
        className={`block break-words leading-snug group-hover:underline ${
          strong ? "text-xs font-medium text-ink" : "text-[13px] text-ink"
        }`}
      >
        {task.title}
      </span>
    </Link>
  );
}
