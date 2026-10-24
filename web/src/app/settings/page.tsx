"use client";

import { useState } from "react";
import type { LlmEffort, LlmModel } from "@/lib/api-types";
import { useDemoMode } from "@/lib/demo/mode";
import {
  LLM_FEATURES,
  resetLlmSettings,
  setLlmSetting,
  useLlmSettings,
  type FeatureSetting,
  type LlmFeature,
} from "@/lib/llm-settings";
import {
  dayKey,
  KEEP_DAYS,
  resetUsage,
  summarizeUsage,
  useUsageStore,
  type UsageTotals,
} from "@/lib/llm-usage";
import { LLM_EFFORTS, LLM_MODELS, modelLabel } from "@/lib/llm/models";

// S-8 AI の設定と使用量（F-17）

const EFFORT_LABELS: Record<LlmEffort | "default", string> = {
  default: "標準（機能ごとの既定）",
  low: "low（速くて安い）",
  medium: "medium",
  high: "high（よく考える。遅く高い）",
};

const selectClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function SettingsPage() {
  const settings = useLlmSettings();
  const store = useUsageStore();
  const demoMode = useDemoMode();
  const [range, setRange] = useState<"today" | "all">("today");

  const change = (feature: LlmFeature, patch: Partial<FeatureSetting>) =>
    setLlmSetting(feature, { ...settings[feature], ...patch });

  const { rows, total } = summarizeUsage(
    store,
    range === "today" ? dayKey(new Date()) : undefined,
  );
  const featureLabel = (id: LlmFeature) =>
    LLM_FEATURES.find((f) => f.id === id)?.label ?? id;

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-bold">AI の設定と使用量</h1>

      <section>
        <h2 className="text-lg font-bold">使う AI</h2>
        <p className="mt-1 text-sm text-gray-600">
          機能ごとに Claude
          のモデルとエフォートを選べます。モデルやエフォートを上げると質が上がる見込みですが、料金と待ち時間も増えます。設定はこのブラウザに保存されます。
        </p>
        {demoMode && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            デモモード中は AI を呼ばないので、この設定は使われません。
          </p>
        )}
        <div className="mt-4 space-y-4">
          {LLM_FEATURES.map((f) => (
            <div key={f.id} className="rounded-lg border border-gray-200 p-4">
              <p className="font-medium text-gray-900">{f.label}</p>
              <p className="text-xs text-gray-500">{f.description}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-700">モデル</span>
                  <select
                    className={selectClass}
                    value={settings[f.id].model}
                    onChange={(e) =>
                      change(f.id, { model: e.target.value as LlmModel })
                    }
                  >
                    {LLM_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}：{m.note}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-700">エフォート</span>
                  <select
                    className={selectClass}
                    value={settings[f.id].effort}
                    onChange={(e) =>
                      change(f.id, {
                        effort: e.target.value as FeatureSetting["effort"],
                      })
                    }
                  >
                    {(["default", ...LLM_EFFORTS] as const).map((e) => (
                      <option key={e} value={e}>
                        {EFFORT_LABELS[e]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={resetLlmSettings}
          className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          標準に戻す（すべて Haiku 5.5・標準のエフォート）
        </button>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">使用量</h2>
          <div className="flex rounded-md border border-gray-300 text-sm">
            {(
              [
                ["today", "今日"],
                ["all", `合計（直近 ${KEEP_DAYS} 日）`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`px-3 py-1.5 ${range === value ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          このブラウザでアプリが AI
          を呼んだ分です。料金は単価表から計算した目安です。正確な請求額は
          Anthropic の Console で確かめてください。
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            {range === "today"
              ? "今日はまだ AI を呼んでいません。"
              : "まだ記録がありません。"}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-2 pr-3 font-medium">機能</th>
                  <th className="py-2 pr-3 font-medium">モデル</th>
                  <th className="py-2 pr-3 text-right font-medium">回数</th>
                  <th className="py-2 pr-3 text-right font-medium">入力</th>
                  <th className="py-2 pr-3 text-right font-medium">出力</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    キャッシュ
                  </th>
                  <th className="py-2 text-right font-medium">料金の目安</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <UsageLine
                    key={`${r.feature}|${r.model}`}
                    feature={featureLabel(r.feature)}
                    model={modelLabel(r.model)}
                    t={r}
                  />
                ))}
                <UsageLine feature="合計" model="" t={total} strong />
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm("記録した使用量をすべて消します。よろしいですか？")
            )
              resetUsage();
          }}
          className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          使用量の記録を消す
        </button>
      </section>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("ja-JP");

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function UsageLine({
  feature,
  model,
  t,
  strong = false,
}: {
  feature: string;
  model: string;
  t: UsageTotals;
  strong?: boolean;
}) {
  const cls = strong
    ? "border-t-2 border-gray-300 font-medium"
    : "border-b border-gray-100";
  return (
    <tr className={cls}>
      <td className="py-2 pr-3">{feature}</td>
      <td className="py-2 pr-3 text-gray-600">{model}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{fmt(t.calls)}</td>
      <td className="py-2 pr-3 text-right tabular-nums">
        {fmt(t.inputTokens)}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">
        {fmt(t.outputTokens)}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">
        {fmt(t.cacheReadTokens + t.cacheWriteTokens)}
      </td>
      <td className="py-2 text-right tabular-nums">{formatUsd(t.costUsd)}</td>
    </tr>
  );
}
