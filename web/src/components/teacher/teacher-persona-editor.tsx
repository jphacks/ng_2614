"use client";

// 先生のキャラクター（F-20）の表示と設定。先生モードの画面の上に置く。
// 画像は縮めてからブラウザに保存する。AI には送らない

import { useState } from "react";
import { toAvatarDataUrl } from "@/lib/avatar-image";
import {
  DEFAULT_TEACHER_NAME,
  deleteTeacherPersona,
  saveTeacherPersona,
} from "@/lib/storage";
import type { TeacherPersona } from "@/lib/types";
import { TeacherAvatar } from "./teacher-avatar";

const MAX_NAME_LENGTH = 30;

export function TeacherPersonaEditor({
  themeId,
  persona,
  onChange,
}: {
  themeId: string;
  persona: TeacherPersona | undefined;
  onChange: (persona: TeacherPersona | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownName = persona?.name || DEFAULT_TEACHER_NAME;

  function startEditing() {
    setName(persona?.name ?? "");
    setImage(persona?.image);
    setError(null);
    setEditing(true);
  }

  async function takeFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setImage(await toAvatarDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像を読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const trimmed = name.trim();
    try {
      if (trimmed === "" && !image) {
        deleteTeacherPersona(themeId);
        onChange(undefined);
      } else {
        onChange(saveTeacherPersona({ themeId, name: trimmed, image }));
      }
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。");
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <TeacherAvatar teacher={{ name: shownName, image: persona?.image }} size={48} />
        <span className="font-medium">{shownName}</span>
        <button
          type="button"
          onClick={startEditing}
          className="text-sm text-blue-700 underline"
        >
          先生を設定する
        </button>
      </div>
    );
  }

  const previewName = name.trim() || DEFAULT_TEACHER_NAME;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="font-bold">先生の設定</p>
      <p className="mt-1 text-xs text-gray-600">
        このプロジェクトの先生モードに出る先生です。画像はこのブラウザにだけ保存し、AI には送りません。
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            takeFile(e.dataTransfer.files[0]);
          }}
          className={`flex w-40 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-3 text-center text-xs ${
            dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
          }`}
        >
          <TeacherAvatar teacher={{ name: previewName, image }} size={80} />
          <span className="text-gray-600">
            {busy ? "読み込み中…" : "画像を選ぶか、ここにドロップ"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              takeFile(e.target.files?.[0]);
              e.target.value = ""; // 同じファイルを選び直せるように
            }}
          />
        </label>

        <div className="min-w-48 flex-1 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">名前</span>
            <input
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              placeholder={`例：山田先生（空なら「${DEFAULT_TEACHER_NAME}」）`}
              className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
            />
          </label>
          {image && (
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="text-sm text-gray-600 underline"
            >
              画像を外す
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          保存する
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
