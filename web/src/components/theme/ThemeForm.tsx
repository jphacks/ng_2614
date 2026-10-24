"use client";

import { useState } from "react";
import type { ResearchTheme } from "@/lib/types";

export type ThemeFormValues = Pick<
  ResearchTheme,
  "name" | "repo" | "question" | "method" | "evaluation"
>;

export const EMPTY_THEME_VALUES: ThemeFormValues = {
  name: "",
  repo: "",
  question: "",
  method: "",
  evaluation: "",
};

export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

type Errors = Partial<Record<keyof ThemeFormValues, string>>;

function validate(values: ThemeFormValues): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "プロジェクト名を入力してください";
  const repo = values.repo.trim();
  if (!repo) {
    errors.repo = "GitHub リポジトリを入力してください";
  } else if (!REPO_PATTERN.test(repo)) {
    errors.repo =
      "owner/name の形式で入力してください（例: tamaki-lab/my-experiment）";
  }
  if (!values.question.trim()) errors.question = "問いを入力してください";
  if (!values.method.trim()) errors.method = "手法を入力してください";
  if (!values.evaluation.trim()) errors.evaluation = "評価を入力してください";
  return errors;
}

type Props = {
  initial?: ThemeFormValues;
  submitLabel: string;
  onSubmit: (values: ThemeFormValues) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  repoLocked?: boolean; // true ならリポジトリは表示だけ（新しいプロジェクト S-6 で選んだもの）
};

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ThemeForm({
  initial = EMPTY_THEME_VALUES,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = "キャンセル",
  repoLocked = false,
}: Props) {
  const [values, setValues] = useState<ThemeFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: keyof ThemeFormValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      name: values.name.trim(),
      repo: values.repo.trim(),
      question: values.question.trim(),
      method: values.method.trim(),
      evaluation: values.evaluation.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field
        label="プロジェクト名"
        error={errors.name}
        input={
          <input
            type="text"
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="例: 〇〇データの分類手法の比較"
            className={inputClass}
          />
        }
      />
      {repoLocked ? (
        <div>
          <span className="text-sm font-medium text-gray-800">
            GitHub リポジトリ
          </span>
          <p className="mt-1 font-mono text-sm text-gray-900">{values.repo}</p>
        </div>
      ) : (
        <Field
          label="GitHub リポジトリ"
          hint="owner/name"
          error={errors.repo}
          input={
            <input
              type="text"
              value={values.repo}
              onChange={(e) => set("repo")(e.target.value)}
              placeholder="例: tamaki-lab/my-experiment"
              className={inputClass}
              autoCapitalize="none"
              spellCheck={false}
            />
          }
        />
      )}
      <Field
        label="問い"
        hint="何を明らかにしたいか"
        error={errors.question}
        input={
          <textarea
            rows={3}
            value={values.question}
            onChange={(e) => set("question")(e.target.value)}
            placeholder="例: 〇〇データの分類で、手法Xは従来手法Yより精度が上がるか"
            className={inputClass}
          />
        }
      />
      <Field
        label="手法"
        hint="どの手法で明らかにするか。ベースラインも書く"
        error={errors.method}
        input={
          <textarea
            rows={3}
            value={values.method}
            onChange={(e) => set("method")(e.target.value)}
            placeholder="例: 手法X。ベースラインはY"
            className={inputClass}
          />
        }
      />
      <Field
        label="評価"
        hint="どう評価するか。評価指標など"
        error={errors.evaluation}
        input={
          <textarea
            rows={2}
            value={values.evaluation}
            onChange={(e) => set("evaluation")(e.target.value)}
            placeholder="例: F1スコア"
            className={inputClass}
          />
        }
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  input,
}: {
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="ml-2 text-xs text-gray-500">{hint}</span>}
      {input}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}
