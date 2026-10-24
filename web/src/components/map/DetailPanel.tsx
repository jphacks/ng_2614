"use client";

import Link from "next/link";
import { useState } from "react";
import type { MapStatus, MapTask, WorkflowMap } from "@/lib/types";
import {
  clearManualStatus,
  confirmTask,
  editTaskText,
  setTaskStatus,
} from "@/lib/map/edit";
import {
  effectiveStatus,
  purposeChain,
  statusLabel,
  subtasksOf,
} from "@/lib/map/view";
import { shortSha } from "@/components/theme/format";
import { AddTaskForm, type AddTaskValues } from "./AddTaskForm";
import {
  SOURCE_KIND_LABEL,
  STATUS_ORDER,
  STATUS_SOURCE_HINT,
  STATUS_SOURCE_LABEL,
} from "./labels";
import { StatusBadge } from "./StatusBadge";

type Edit = (fn: (map: WorkflowMap, now: string) => WorkflowMap) => boolean;

const REVIEW_LABEL: Record<MapTask["review"], string> = {
  unconfirmed: "AI作成・未確認",
  confirmed: "確認済み",
  edited: "人が直した",
};

// 選んだタスク・サブタスクの詳細。幅の広い画面では右、狭い画面ではマップの下に置く
export function DetailPanel({
  map,
  task,
  question,
  onSelect,
  onClose,
  onEdit,
  onAddSubtask,
  onDelete,
}: {
  map: WorkflowMap;
  task: MapTask;
  question: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onEdit: Edit;
  onAddSubtask: (parentId: string, values: AddTaskValues) => boolean;
  onDelete: (taskId: string, reason: string | undefined) => void;
}) {
  const phase = map.phases.find((p) => p.id === task.phaseId);
  const status = effectiveStatus(map, task);
  const subtasks = subtasksOf(map, task.id);
  const chain = purposeChain(map, task.id);
  const parent = task.parentId
    ? map.tasks.find((t) => t.id === task.parentId)
    : undefined;
  const milestone = task.milestoneId
    ? map.milestones.find((m) => m.id === task.milestoneId)
    : undefined;

  return (
    <aside
      aria-label="詳細"
      className="space-y-5 rounded-md border border-gray-300 bg-white p-4 text-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-gray-500">
            {phase?.name ?? "（レーンなし）"}
            {parent ? `　サブタスク（親：${parent.title}）` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
        <h2 className="mt-1 text-base font-bold text-gray-900">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge label={statusLabel(phase, status)} status={status} />
          <span
            className="text-xs text-gray-500"
            title={STATUS_SOURCE_HINT[task.statusSource]}
          >
            {STATUS_SOURCE_LABEL[task.statusSource]}
          </span>
          <span className="text-xs text-gray-500">
            ・{REVIEW_LABEL[task.review]}
          </span>
          {milestone && (
            <span className="text-xs text-gray-500">
              ・マイルストーン：{milestone.title}
            </span>
          )}
        </div>
        {task.flag === "unrecorded" && (
          <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            記録のない実装です。どのドキュメントにも出てこないので、目的を確かめてください。
          </p>
        )}
        {/* 元の文言は、状態の言葉と違って情報が増えるときだけ出す */}
        {task.statusRaw && task.statusRaw !== statusLabel(phase, status) && (
          <p className="mt-1 font-mono text-xs text-gray-400">
            元の文言：{task.statusRaw}
          </p>
        )}
        {task.result && (
          <p className="mt-1 text-xs text-gray-600">結果：{task.result}</p>
        )}
        {task.status === "rejected" && task.rejectReason && (
          <p className="mt-1 text-xs text-gray-600">
            不採用の理由：{task.rejectReason}
          </p>
        )}
      </div>

      <Section title="目的のつながり">
        <ol className="space-y-1">
          <li className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">
            <span className="font-medium">研究の問い</span>
            <span className="block whitespace-pre-wrap text-gray-600">
              {question}
            </span>
          </li>
          {chain.map((t, i) => {
            const selected = t.id === task.id;
            return (
              <li key={t.id} style={{ paddingLeft: `${(i + 1) * 12}px` }}>
                <button
                  type="button"
                  disabled={selected}
                  onClick={() => onSelect(t.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`w-full rounded px-2 py-1 text-left text-xs ${
                    selected
                      ? "border border-blue-400 bg-blue-50 font-bold text-blue-900"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {"└ "}
                  {t.title}
                  {t.purpose && (
                    <span className="block font-normal text-gray-500">
                      {t.purpose}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="出典">
        {task.sources.length === 0 ? (
          <p className="text-xs text-gray-500">出典はありません。</p>
        ) : (
          <ul className="space-y-1">
            {task.sources.map((s, i) => {
              const text = s.label || s.path;
              return (
                <li key={`${s.path}-${i}`} className="text-xs">
                  <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                    {SOURCE_KIND_LABEL[s.kind]}
                  </span>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-700 hover:underline"
                    >
                      {text}
                    </a>
                  ) : (
                    <span className="break-all text-gray-700">{text}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {(task.commitShas.length > 0 || task.reviewIds.length > 0) && (
        <Section title="コミットと判定">
          {task.commitShas.length > 0 && (
            <p className="flex flex-wrap gap-1.5 text-xs">
              {task.commitShas.map((sha) => (
                <span
                  key={sha}
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700"
                >
                  {shortSha(sha)}
                </span>
              ))}
            </p>
          )}
          {task.reviewIds.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {task.reviewIds.map((id, i) => (
                <li key={id}>
                  <Link
                    href={`/reviews/${id}`}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    判定を見る（{i + 1}）
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <StatusSection
        key={`status:${task.id}:${task.status}:${task.statusSource}`}
        task={task}
        phaseLabel={(s) => statusLabel(phase, s)}
        onSet={(s, reason) =>
          onEdit((m, now) => setTaskStatus(m, task.id, s, reason, now))
        }
        onClear={() => onEdit((m, now) => clearManualStatus(m, task.id, now))}
      />

      <TextSection
        key={`text:${task.id}:${task.title}:${task.purpose}`}
        task={task}
        onSave={(patch) =>
          onEdit((m, now) => editTaskText(m, task.id, patch, now))
        }
      />

      {task.review === "unconfirmed" && (
        <div>
          <button
            type="button"
            onClick={() => onEdit((m, now) => confirmTask(m, task.id, now))}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            確認済みにする
          </button>
        </div>
      )}

      {!task.parentId && (
        <SubtaskSection
          key={`sub:${task.id}`}
          onAdd={(values) => onAddSubtask(task.id, values)}
        />
      )}

      <DeleteSection
        key={`del:${task.id}`}
        hasSubtasks={subtasks.length > 0}
        onDelete={(reason) => onDelete(task.id, reason)}
      />
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-bold text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function StatusSection({
  task,
  phaseLabel,
  onSet,
  onClear,
}: {
  task: MapTask;
  phaseLabel: (s: MapStatus) => string;
  onSet: (status: MapStatus, reason: string | undefined) => boolean;
  onClear: () => boolean;
}) {
  const [choosingReject, setChoosingReject] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Section title="状態">
      <div
        role="group"
        aria-label="状態を選ぶ"
        className="flex flex-wrap gap-1.5"
      >
        {STATUS_ORDER.map((s) => {
          const current = task.status === s && !choosingReject;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={current || (choosingReject && s === "rejected")}
              onClick={() => {
                if (s === "rejected") {
                  setChoosingReject(true);
                } else {
                  setChoosingReject(false);
                  onSet(s, undefined);
                }
              }}
              className={`rounded border px-2 py-1 text-xs ${
                current || (choosingReject && s === "rejected")
                  ? "border-blue-600 bg-blue-50 font-bold text-blue-900"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {phaseLabel(s)}
            </button>
          );
        })}
      </div>
      {choosingReject && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-gray-700">
            {phaseLabel("rejected")}にする理由（必須）
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={reason.trim() === ""}
              onClick={() => {
                if (onSet("rejected", reason.trim())) setChoosingReject(false);
              }}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              この理由で決める
            </button>
            <button
              type="button"
              onClick={() => setChoosingReject(false)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              やめる
            </button>
          </div>
        </div>
      )}
      {task.statusSource === "manual" && (
        <div className="mt-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            手動の固定を外す
          </button>
          <span className="ml-2 text-xs text-gray-500">
            記録からの自動更新に戻します
          </span>
        </div>
      )}
    </Section>
  );
}

function TextSection({
  task,
  onSave,
}: {
  task: MapTask;
  onSave: (patch: { title?: string; purpose?: string }) => boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const [purpose, setPurpose] = useState(task.purpose);
  const changed =
    title.trim() !== task.title || purpose.trim() !== task.purpose;

  return (
    <Section title="タイトルと目的を直す">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!changed || title.trim() === "") return;
          onSave({ title: title.trim(), purpose: purpose.trim() });
        }}
      >
        <label className="block text-xs text-gray-700">
          タイトル
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-700">
          目的
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={!changed || title.trim() === ""}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          直した内容を保存する
        </button>
      </form>
    </Section>
  );
}

function SubtaskSection({
  onAdd,
}: {
  onAdd: (values: AddTaskValues) => boolean;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Section title="サブタスク">
      {adding ? (
        <AddTaskForm
          submitLabel="サブタスクを足す"
          onSubmit={onAdd}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          ＋ サブタスクを足す
        </button>
      )}
    </Section>
  );
}

function DeleteSection({
  hasSubtasks,
  onDelete,
}: {
  hasSubtasks: boolean;
  onDelete: (reason: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Section title="消す">
      {open ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-600">
            消したものは「却下したもの」に残り、あとで戻せます。AI も同じものを再び提案しません。
            {hasSubtasks && "サブタスクもいっしょに消えます。"}
          </p>
          <label className="block text-xs text-gray-700">
            理由（なくてもよい）
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDelete(reason.trim() || undefined)}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              消す
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          このタスクを消す
        </button>
      )}
    </Section>
  );
}
