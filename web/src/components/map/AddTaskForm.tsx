"use client";

import { useState } from "react";
import type { MapMilestone } from "@/lib/types";

export type AddTaskValues = {
  title: string;
  purpose: string;
  milestoneId?: string;
};

// タスク・サブタスクを足す小さなフォーム。milestones を渡すと、マイルストーンも選べる
export function AddTaskForm({
  milestones,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  milestones?: MapMilestone[];
  submitLabel: string;
  onSubmit: (values: AddTaskValues) => boolean;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [milestoneId, setMilestoneId] = useState("");

  const canSubmit = title.trim() !== "";

  return (
    <form
      className="space-y-2 rounded-md border border-gray-200 bg-white p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const ok = onSubmit({
          title: title.trim(),
          purpose: purpose.trim(),
          milestoneId: milestoneId || undefined,
        });
        if (ok) {
          setTitle("");
          setPurpose("");
          onCancel();
        }
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
        目的（なくてもよい）
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      {milestones && milestones.length > 0 && (
        <label className="block text-xs text-gray-700">
          マイルストーン
          <select
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">なし</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          やめる
        </button>
      </div>
    </form>
  );
}
