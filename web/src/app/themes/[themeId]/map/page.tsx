"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDemoMode } from "@/lib/demo/mode";
import { undoLastUpdate } from "@/lib/map/apply";
import {
  generateOrRegenerate,
  refreshFromWorkspace,
} from "@/lib/map/auto-update";
import {
  addPhase,
  addTask,
  deletePhase,
  deleteTask,
  movePhase,
  renamePhase,
  restoreRejected,
} from "@/lib/map/edit";
import { unconfirmedCount } from "@/lib/map/view";
import {
  getTheme,
  getWorkflowMap,
  MAPS_CHANGED_EVENT,
  nowIso,
  saveWorkflowMap,
} from "@/lib/storage";
import type { ResearchTheme, WorkflowMap } from "@/lib/types";
import type { AddTaskValues } from "@/components/map/AddTaskForm";
import { DetailPanel } from "@/components/map/DetailPanel";
import { errorMessage, type MilestoneFilter } from "@/components/map/labels";
import { MapBoard } from "@/components/map/MapBoard";
import { PhaseControls } from "@/components/map/PhaseControls";
import { RejectedList } from "@/components/map/RejectedList";
import { UpdateNotice } from "@/components/map/UpdateNotice";
import {
  WorkspaceForm,
  WorkspaceSendNotice,
  type WorkspaceValues,
} from "@/components/map/WorkspaceForm";

type Loaded =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "ready"; theme: ResearchTheme; map: WorkflowMap | undefined };

function load(themeId: string): Loaded {
  const theme = getTheme(themeId);
  if (!theme) return { status: "notFound" };
  return { status: "ready", theme, map: getWorkflowMap(themeId) };
}

// S-7 作業フローマップ
export default function WorkflowMapPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [filter, setFilter] = useState<MilestoneFilter>("all");
  // 開いているタスクの id。保存はしない（開き直したら閉じた状態）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // URL の ?task=<taskId>（画面上部の帯から飛んでくる）。マップを読めたら一度だけ使う
  const pendingTaskRef = useRef<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const demo = useDemoMode();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    setState(load(themeId));
    setSelectedId(undefined);
    setFilter("all");
    setExpandedIds(new Set());
    setRefreshResult(null);
    setRefreshError(null);
    setSettingsOpen(false);
    setSettingsSaved(false);
  }, [themeId]);

  // 判定の保存で始まった自動更新や、ほかのタブでの変更を、開いたままの画面に反映する
  useEffect(() => {
    function reload() {
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, map: getWorkflowMap(themeId) }
          : prev,
      );
    }
    window.addEventListener(MAPS_CHANGED_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(MAPS_CHANGED_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [themeId]);

  // マウント後に ?task= を読む（useSearchParams は使わない）
  useEffect(() => {
    pendingTaskRef.current = new URLSearchParams(window.location.search).get(
      "task",
    );
  }, []);

  // マップを読み込めたら、?task= のタスクを選び、サブタスクなら親を開き、そこまでスクロールする
  useEffect(() => {
    const taskId = pendingTaskRef.current;
    if (!taskId || state.status !== "ready" || !state.map) return;
    pendingTaskRef.current = null;
    const target = state.map.tasks.find((t) => t.id === taskId);
    if (!target) return;
    setSelectedId(target.id);
    const parentId = target.parentId;
    if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
    window.setTimeout(() => {
      const el =
        document.getElementById(`map-task-${target.id}`) ??
        (parentId ? document.getElementById(`map-task-${parentId}`) : null);
      el?.scrollIntoView({ block: "center" });
    }, 50);
  }, [state]);

  if (state.status === "loading") {
    return <p className="text-sm text-gray-500">読み込み中...</p>;
  }
  if (state.status === "notFound") {
    return (
      <div>
        <p className="text-gray-700">プロジェクトが見つかりません。</p>
        <Link
          href="/"
          className="mt-2 inline-block text-blue-700 hover:underline"
        >
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  const { theme, map } = state;

  // マップを保存して、画面の状態を更新する
  const persist = (next: WorkflowMap) => {
    saveWorkflowMap(next);
    setState({ status: "ready", theme, map: next });
  };

  // edit の関数を呼ぶ。Error を投げたらメッセージを出す。成功したかを返す
  const edit = (
    fn: (current: WorkflowMap, now: string) => WorkflowMap,
  ): boolean => {
    if (!map) return false;
    try {
      persist(fn(map, nowIso()));
      setActionError(null);
      return true;
    } catch (e) {
      setActionError(errorMessage(e));
      return false;
    }
  };

  // タスクやサブタスクを選ぶ。サブタスクなら、その親カードを開く
  const select = (id: string | undefined) => {
    setSelectedId(id);
    const parentId = id
      ? map?.tasks.find((t) => t.id === id)?.parentId
      : undefined;
    if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAllExpanded = (open: boolean) => {
    setExpandedIds(
      open && map
        ? new Set(map.tasks.filter((t) => !t.parentId).map((t) => t.id))
        : new Set(),
    );
  };

  const handleAddTask = (
    phaseId: string,
    parentId: string | undefined,
    values: AddTaskValues,
  ): boolean => {
    if (!map) return false;
    try {
      const result = addTask(map, { phaseId, parentId, ...values }, nowIso());
      persist(result.map);
      setSelectedId(result.task.id);
      if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
      setActionError(null);
      return true;
    } catch (e) {
      setActionError(errorMessage(e));
      return false;
    }
  };

  const handleUndo = () => {
    if (!map) return;
    try {
      const previous = undoLastUpdate(map);
      if (!previous) {
        setActionError("取り消せる自動更新がありません");
        return;
      }
      persist(previous);
      setSelectedId(undefined);
      setActionError(null);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  // マップを作る／作り直す。作り直しは丸ごと置き換えず、人の手直しと却下の記録を残して当てはめる
  const generate = async (workspace: {
    workspaceRepo?: string;
    workspaceProject?: string;
  }) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateOrRegenerate(theme, workspace);
      setState({ status: "ready", theme, map: getWorkflowMap(theme.id) });
      setSelectedId(undefined);
      setFilter("all");
      setExpandedIds(new Set());
      setActionError(null);
      setRefreshResult(null);
      setRefreshError(null);
    } catch (e) {
      setGenerateError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    const ok = window.confirm(
      "ワークスペースの今の内容から、マップを作り直します。人が直した内容と、消したものの記録は残し、AI が作った部分だけを今の内容に合わせて更新します。ワークスペースの中身は AI（Claude）に送られます。よろしいですか？",
    );
    if (ok) {
      void generate({
        workspaceRepo: map?.workspaceRepo,
        workspaceProject: map?.workspaceProject,
      });
    }
  };

  const hasWorkspace = !!map?.workspaceRepo && !!map?.workspaceProject;

  // ワークスペースから更新。前回から変わったファイルだけを読む
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    setRefreshError(null);
    try {
      const count = await refreshFromWorkspace(theme);
      setState({ status: "ready", theme, map: getWorkflowMap(theme.id) });
      setRefreshResult(
        count > 0
          ? `ワークスペースの変更を ${count} 件、マップに反映しました。`
          : "ワークスペースに、反映する変更はありませんでした。",
      );
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  // ワークスペースの設定を変える。別のリポジトリ・プロジェクトになったら、前回読んだ位置は使えないので消す
  const handleSaveSettings = (values: WorkspaceValues) => {
    if (!map) return;
    const changed =
      values.workspaceRepo !== map.workspaceRepo ||
      values.workspaceProject !== map.workspaceProject;
    const { workspaceSha, ...rest } = map;
    persist({
      ...rest,
      ...(changed || !workspaceSha ? {} : { workspaceSha }),
      ...values,
      updatedAt: nowIso(),
    });
    setSettingsOpen(false);
    setSettingsSaved(true);
    setRefreshResult(null);
    setRefreshError(null);
  };

  const selected =
    map && selectedId ? map.tasks.find((t) => t.id === selectedId) : undefined;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/themes/${theme.id}`}
          className="text-sm text-blue-700 hover:underline"
        >
          ← プロジェクト
        </Link>
        <h1 className="mt-2 text-xl font-bold">作業フローマップ</h1>
        <p className="mt-1 text-sm text-gray-600">
          <span className="font-medium text-gray-700">研究の問い：</span>
          {theme.question}
        </p>
        {map && (
          <p className="mt-1 text-sm text-amber-800">
            AI作成・未確認 {unconfirmedCount(map)}件
          </p>
        )}
      </div>

      {!map ? (
        <section className="space-y-3 rounded-md border border-gray-200 p-4">
          <p className="text-sm text-gray-700">
            まだマップがありません。研究の工程（調査・選定・実装・検証・報告など）を、
            タスクとそのつながりとして AI が並べます。作ったあとで、人が直せます。
          </p>
          {demo ? (
            <>
              <p className="text-sm text-gray-600">
                デモモードです。ワークスペースは読まず、デモ用のデータでマップを作ります。
              </p>
              <button
                type="button"
                disabled={generating}
                onClick={() => void generate({})}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? "マップを作っています…" : "マップを作る"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                マップの元にする research-workspace（GitHub のリポジトリと、その中のプロジェクト名）を入力してください。入力した内容はこのマップに保存され、次からは聞きません（あとで設定から変えられます）。
              </p>
              <WorkspaceForm
                submitLabel="マップを作る"
                busyLabel="ワークスペースを読んでいます…"
                busy={generating}
                onSubmit={(values) => void generate(values)}
              />
            </>
          )}
          {generating && (
            <p role="status" className="text-sm text-gray-500">
              {demo ? "マップを作っています…" : "ワークスペースを読んでいます…"}
            </p>
          )}
          {generateError && (
            <p role="alert" className="text-sm text-red-700">
              {generateError}
            </p>
          )}
        </section>
      ) : (
        <>
          {actionError && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}
          <UpdateNotice map={map} onUndo={handleUndo} />

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                disabled={refreshing || generating || demo || !hasWorkspace}
                onClick={() => void handleRefresh()}
                className="rounded-md border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? "ワークスペースを読んでいます…"
                  : "ワークスペースから更新"}
              </button>
              {demo ? (
                <span className="text-xs text-gray-600">
                  デモモードでは、ワークスペースを読まないので使えません。
                </span>
              ) : !hasWorkspace ? (
                <span className="text-xs text-gray-600">
                  ワークスペースが未設定です。下の「ワークスペースの設定」で入力してください。
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  前回から変わったファイルだけを読みます。
                </span>
              )}
            </div>
            {refreshing && (
              <p role="status" className="text-xs text-gray-500">
                変わったファイルを AI（Claude）に送って、マップへの変更を考えています…
              </p>
            )}
            {refreshResult && (
              <p role="status" className="text-sm text-blue-900">
                {refreshResult}
              </p>
            )}
            {refreshError && (
              <p role="alert" className="text-sm text-red-700">
                {refreshError}
              </p>
            )}
          </div>

          {/* main（max-w-4xl）より広く使う。transform で動かすとページに横スクロールが出るので、余白で中央に寄せる */}
          <div className="ml-[calc(50%-min(40rem,calc(50vw-2rem)))] w-[min(80rem,calc(100vw-4rem))]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <div className="min-w-0 flex-1">
                <MapBoard
                  map={map}
                  filter={filter}
                  onFilterChange={setFilter}
                  selectedId={selected?.id}
                  expandedIds={expandedIds}
                  onToggle={toggleExpanded}
                  onSetAllExpanded={setAllExpanded}
                  onSelect={select}
                  onAddTask={(phaseId, values) =>
                    handleAddTask(phaseId, undefined, values)
                  }
                />
                {!selected && (
                  <p className="mt-1 text-xs text-gray-500">
                    カードやサブタスクを選ぶと、目的のつながりや出典などの詳細が見られます。
                  </p>
                )}
              </div>
              {selected && (
                <div className="lg:w-96 lg:shrink-0">
                  <DetailPanel
                    map={map}
                    task={selected}
                    question={theme.question}
                    onSelect={select}
                    onClose={() => setSelectedId(undefined)}
                    onEdit={edit}
                    onAddSubtask={(parentId, values) =>
                      handleAddTask(selected.phaseId, parentId, values)
                    }
                    onDelete={(taskId, reason) => {
                      const ok = edit((m, now) =>
                        deleteTask(m, taskId, reason, now),
                      );
                      if (ok) setSelectedId(undefined);
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <RejectedList
              rejected={map.rejected}
              onRestore={(index) =>
                edit((m, now) => restoreRejected(m, index, now))
              }
            />
            <PhaseControls
              map={map}
              onAdd={(name) => edit((m, now) => addPhase(m, name, now))}
              onRename={(phaseId, name) =>
                edit((m, now) => renamePhase(m, phaseId, name, now))
              }
              onMove={(phaseId, delta) =>
                edit((m, now) => movePhase(m, phaseId, delta, now))
              }
              onDelete={(phaseId) =>
                edit((m, now) => deletePhase(m, phaseId, now))
              }
            />
            <section
              aria-labelledby="map-workspace-heading"
              className="space-y-3 rounded-md border border-gray-200 p-3"
            >
              <h2
                id="map-workspace-heading"
                className="text-sm font-semibold text-gray-800"
              >
                ワークスペース
              </h2>
              {demo ? (
                <p className="text-sm text-gray-600">
                  デモモードです。ワークスペースは読まず、デモ用のデータを使います（設定は不要です）。
                </p>
              ) : hasWorkspace ? (
                <p className="text-sm text-gray-700">
                  <code className="font-mono">{map.workspaceRepo}</code> の{" "}
                  <code className="font-mono">{map.workspaceProject}</code>
                </p>
              ) : (
                <p className="text-sm text-amber-800">
                  ワークスペースが未設定です。下の設定で入力すると、「ワークスペースから更新」と「マップを作り直す」が使えます。
                </p>
              )}
              {settingsSaved && !settingsOpen && (
                <p role="status" className="text-sm text-green-700">
                  ワークスペースの設定を保存しました。
                </p>
              )}
              {!demo && (
                <div>
                  <button
                    type="button"
                    aria-expanded={settingsOpen}
                    aria-controls="map-workspace-settings"
                    onClick={() => {
                      setSettingsOpen((v) => !v);
                      setSettingsSaved(false);
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {settingsOpen
                      ? "ワークスペースの設定を閉じる"
                      : "ワークスペースの設定"}
                  </button>
                  <div id="map-workspace-settings" className="mt-3">
                    {settingsOpen && (
                      <WorkspaceForm
                        key={`${map.workspaceRepo ?? ""}/${map.workspaceProject ?? ""}`}
                        initialRepo={map.workspaceRepo}
                        initialProject={map.workspaceProject}
                        submitLabel="設定を保存"
                        onSubmit={handleSaveSettings}
                        onCancel={() => setSettingsOpen(false)}
                      />
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {!settingsOpen && !demo && <WorkspaceSendNotice />}
                <div>
                  <button
                    type="button"
                    disabled={
                      generating || refreshing || (!demo && !hasWorkspace)
                    }
                    onClick={handleRegenerate}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating
                      ? demo
                        ? "マップを作り直しています…"
                        : "ワークスペースを読んでいます…"
                      : "マップを作り直す"}
                  </button>
                  <span className="ml-2 text-xs text-gray-500">
                    人が直した内容と、消したものの記録は残ります。
                  </span>
                </div>
                {generateError && (
                  <p role="alert" className="text-sm text-red-700">
                    {generateError}
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
