"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postMapGenerate } from "@/lib/api-client";
import { undoLastUpdate } from "@/lib/map/apply";
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
import { getTheme, getWorkflowMap, nowIso, saveWorkflowMap } from "@/lib/storage";
import type { ResearchTheme, WorkflowMap } from "@/lib/types";
import type { AddTaskValues } from "@/components/map/AddTaskForm";
import { DetailPanel } from "@/components/map/DetailPanel";
import { errorMessage, type MilestoneFilter } from "@/components/map/labels";
import { MapBoard } from "@/components/map/MapBoard";
import { PhaseControls } from "@/components/map/PhaseControls";
import { RejectedList } from "@/components/map/RejectedList";
import { UpdateNotice } from "@/components/map/UpdateNotice";

type Loaded =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "ready"; theme: ResearchTheme; map: WorkflowMap | undefined };

function load(themeId: string): Loaded {
  const theme = getTheme(themeId);
  if (!theme) return { status: "notFound" };
  return { status: "ready", theme, map: getWorkflowMap(themeId) };
}

// S-6 作業フローマップ
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

  useEffect(() => {
    setState(load(themeId));
    setSelectedId(undefined);
    setFilter("all");
    setExpandedIds(new Set());
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
        <p className="text-gray-700">研究テーマが見つかりません。</p>
        <Link
          href="/"
          className="mt-2 inline-block text-blue-700 hover:underline"
        >
          研究テーマ一覧へ戻る
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

  const generate = async (existing: WorkflowMap | undefined) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await postMapGenerate({
        themeId: theme.id,
        theme: {
          name: theme.name,
          question: theme.question,
          method: theme.method,
          evaluation: theme.evaluation,
        },
        repo: theme.repo,
        workspaceRepo: existing?.workspaceRepo,
        workspaceProject: existing?.workspaceProject,
      });
      saveWorkflowMap(response.map);
      setState({ status: "ready", theme, map: response.map });
      setSelectedId(undefined);
      setFilter("all");
      setExpandedIds(new Set());
      setActionError(null);
    } catch (e) {
      setGenerateError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    const ok = window.confirm(
      "マップを作り直します。人が直した内容や、消したものの記録は、新しいマップに置き換わります。よろしいですか？",
    );
    if (ok) void generate(map);
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
          ← 研究テーマ
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
        <section className="rounded-md border border-gray-200 p-4">
          <p className="text-sm text-gray-700">
            まだマップがありません。研究の工程（調査・選定・実装・検証・報告など）を、
            タスクとそのつながりとして AI が並べます。作ったあとで、人が直せます。
          </p>
          <div className="mt-3">
            <button
              type="button"
              disabled={generating}
              onClick={() => void generate(undefined)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "ワークスペースを読んでいます…" : "マップを作る"}
            </button>
          </div>
          {generating && (
            <p role="status" className="mt-2 text-sm text-gray-500">
              ワークスペースを読んでいます…
            </p>
          )}
          {generateError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
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
            <div>
              <button
                type="button"
                disabled={generating}
                onClick={handleRegenerate}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {generating ? "ワークスペースを読んでいます…" : "マップを作り直す"}
              </button>
              {generateError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {generateError}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
