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
          className="link text-sm"
        >
          先生を設定する
        </button>
      </div>
    );
  }

  const previewName = name.trim() || DEFAULT_TEACHER_NAME;

  return (
    <div className="rounded-[4px] border border-hair bg-sheet p-4">
      <p className="font-bold">先生の設定</p>
      <p className="mt-1 text-xs text-ink-2">
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
          className={`flex w-40 cursor-pointer flex-col items-center gap-2 rounded-[4px] border-2 border-dashed p-3 text-center text-xs ${
            dragging ? "border-accent bg-accent-soft" : "border-hair hover:bg-paper-2"
          }`}
        >
          <TeacherAvatar teacher={{ name: previewName, image }} size={80} />
          <span className="text-ink-2">
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
              className="field mt-1"
            />
          </label>
          {image && (
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="link-quiet text-sm"
            >
              画像を外す
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-pen">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn-primary"
        >
          保存する
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
