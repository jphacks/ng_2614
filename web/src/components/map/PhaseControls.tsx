"use client";

import { useState } from "react";
import type { WorkflowMap } from "@/lib/types";
import { sortedPhases } from "@/lib/map/view";

// レーンの操作（足す・名前を変える・左右に動かす・空なら消す）。控えめに折りたたんでおく
export function PhaseControls({
  map,
  onRename,
  onMove,
  onDelete,
  onAdd,
}: {
  map: WorkflowMap;
  onRename: (phaseId: string, name: string) => boolean;
  onMove: (phaseId: string, delta: -1 | 1) => void;
  onDelete: (phaseId: string) => void;
  onAdd: (name: string) => boolean;
}) {
  const phases = sortedPhases(map);
  const [newName, setNewName] = useState("");

  return (
    <details className="rounded-md border border-gray-200 p-3 text-sm">
      <summary className="cursor-pointer text-gray-700">
        レーンを編集する
      </summary>
      <ul className="mt-3 space-y-2">
        {phases.map((phase, i) => {
          const taskCount = map.tasks.filter(
            (t) => t.phaseId === phase.id,
          ).length;
          return (
            <PhaseRow
              key={`${phase.id}:${phase.name}`}
              name={phase.name}
              isFirst={i === 0}
              isLast={i === phases.length - 1}
              taskCount={taskCount}
              onRename={(name) => onRename(phase.id, name)}
              onMove={(d) => onMove(phase.id, d)}
              onDelete={() => onDelete(phase.id)}
            />
          );
        })}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim() === "") return;
          if (onAdd(newName.trim())) setNewName("");
        }}
      >
        <label className="flex items-center gap-2 text-xs text-gray-700">
          新しいレーン
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={newName.trim() === ""}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          末尾に足す
        </button>
      </form>
    </details>
  );
}

function PhaseRow({
  name,
  isFirst,
  isLast,
  taskCount,
  onRename,
  onMove,
  onDelete,
}: {
  name: string;
  isFirst: boolean;
  isLast: boolean;
  taskCount: number;
  onRename: (name: string) => boolean;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const button =
    "rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40";
  return (
    <li className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        value={draft}
        aria-label={`レーン名：${name}`}
        onChange={(e) => setDraft(e.target.value)}
        className="w-36 rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={draft.trim() === "" || draft.trim() === name}
        onClick={() => onRename(draft.trim())}
        className={button}
      >
        名前を変える
      </button>
      <button
        type="button"
        disabled={isFirst}
        onClick={() => onMove(-1)}
        aria-label={`${name}を左へ動かす`}
        className={button}
      >
        ← 左へ
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={() => onMove(1)}
        aria-label={`${name}を右へ動かす`}
        className={button}
      >
        右へ →
      </button>
      <button
        type="button"
        disabled={taskCount > 0}
        title={
          taskCount > 0 ? "タスクが残っているレーンは消せません" : undefined
        }
        onClick={onDelete}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
      >
        消す
      </button>
      {taskCount > 0 && (
        <span className="text-xs text-gray-400">タスク {taskCount}件</span>
      )}
    </li>
  );
}
