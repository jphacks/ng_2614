"use client";

import { useEffect, useState } from "react";
import { listThemes, newId, saveTheme } from "@/lib/storage";
import type { ResearchTheme } from "@/lib/types";
import { ThemeForm, type ThemeFormValues } from "@/components/theme/ThemeForm";
import { ThemeList } from "@/components/theme/ThemeList";

// S-1 研究テーマ一覧・登録
export default function Home() {
  const [themes, setThemes] = useState<ResearchTheme[] | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    setThemes(listThemes());
  }, []);

  const handleSubmit = (values: ThemeFormValues) => {
    saveTheme({ id: newId(), ...values, updatedAt: "" }); // updatedAt は保存時に付く
    setThemes(listThemes());
    setFormKey((k) => k + 1); // フォームを空に戻す
  };

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-xl font-bold">研究テーマ</h1>
        <div className="mt-4">
          {themes === null ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : (
            <ThemeList themes={themes} />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">研究テーマを登録する</h2>
        <p className="mt-1 text-sm text-gray-600">
          研究の目的（問い・手法・評価）を書いておくと、AI の変更が研究にどう影響するかを照らし合わせられます。
        </p>
        <div className="mt-4">
          <ThemeForm
            key={formKey}
            submitLabel="登録する"
            onSubmit={handleSubmit}
          />
        </div>
      </section>
    </div>
  );
}
