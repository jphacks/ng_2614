"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { demoTheme } from "@/lib/demo/data";
import { useDemoMode } from "@/lib/demo/mode";
import { listThemes, newId, saveTheme } from "@/lib/storage";
import type { ResearchTheme } from "@/lib/types";
import { ThemeForm, type ThemeFormValues } from "@/components/theme/ThemeForm";
import { ThemeList } from "@/components/theme/ThemeList";

// S-1 研究テーマ一覧・登録
export default function Home() {
  const [themes, setThemes] = useState<ResearchTheme[] | null>(null);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const demoMode = useDemoMode();

  useEffect(() => {
    setThemes(listThemes());
  }, []);

  const handleSubmit = (values: ThemeFormValues) => {
    saveTheme({ id: newId(), ...values, updatedAt: "" }); // updatedAt は保存時に付く
    setThemes(listThemes());
    setFormKey((k) => k + 1); // フォームを空に戻す
  };

  const handleCreateDemo = () => {
    saveTheme({ ...demoTheme, updatedAt: "" });
    router.push(`/themes/${demoTheme.id}`);
  };

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-xl font-bold">研究テーマ</h1>
        {demoMode && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="text-amber-900">
              デモ用の研究テーマ（健診データの疾患分類）で、取り込み → 判定 → 先生モードを試せます。
            </p>
            <button
              type="button"
              onClick={handleCreateDemo}
              className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
            >
              デモ用の研究テーマを作る
            </button>
          </div>
        )}
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
