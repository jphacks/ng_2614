"use client";

import { useState } from "react";
import { ConnectionsSection } from "@/components/settings/ConnectionsSection";
import { Segmented } from "@/components/settings/Segmented";
import type { LlmEffort, LlmModel } from "@/lib/api-types";
import { useDemoMode } from "@/lib/demo/mode";
import {
  DEFAULT_LLM_SETTINGS,
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
import {
  DEFAULT_MODEL,
  LLM_EFFORTS,
  LLM_MODELS,
  modelLabel,
} from "@/lib/llm/models";

// S-8 設定：接続（F-18）、使う AI と使用量（F-17）

const base = LLM_MODELS.find((m) => m.id === DEFAULT_MODEL)!.price.input;

const MODEL_OPTIONS = LLM_MODELS.map((m) => ({
  value: m.id,
  label: m.label.replace("Claude ", ""),
  sub:
    m.id === DEFAULT_MODEL
      ? "標準・安い"
      : `料金 約${Math.round(m.price.input / base)}倍`,
}));

const EFFORT_OPTIONS: {
  value: LlmEffort | "default";
  label: string;
  sub: string;
}[] = [
  { value: "default", label: "標準", sub: "機能の既定" },
  ...LLM_EFFORTS.map((e) => ({
    value: e,
    label: e,
    sub: { low: "速い", medium: "ふつう", high: "よく考える" }[e],
  })),
];

export default function SettingsPage() {
  const settings = useLlmSettings();
  const store = useUsageStore();
  const demoMode = useDemoMode();
  const [range, setRange] = useState<"today" | "all">("today");

  const change = (feature: LlmFeature, patch: Partial<FeatureSetting>) =>
    setLlmSetting(feature, { ...settings[feature], ...patch });

  const today = summarizeUsage(store, dayKey(new Date()));
  const all = summarizeUsage(store);
  const shown = range === "today" ? today : all;
  const isDefault = (f: LlmFeature) =>
    settings[f].model === DEFAULT_LLM_SETTINGS[f].model &&
    settings[f].effort === DEFAULT_LLM_SETTINGS[f].effort;
  const anyChanged = LLM_FEATURES.some((f) => !isDefault(f.id));

  // その機能・モデルでのこれまでの 1 回あたりの料金
  const averageCost = (feature: LlmFeature, model: LlmModel) => {
    const row = all.rows.find(
      (r) => r.feature === feature && r.model === model,
    );
    return row && row.calls > 0 ? row.costUsd / row.calls : undefined;
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold">設定</h1>
        {demoMode && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            デモモード中は AI
            を呼ばないので、この設定は使われず、使用量も増えません。
          </p>
        )}
      </div>

      <ConnectionsSection />

      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">使う AI</h2>
          {anyChanged && (
            <button
              type="button"
              onClick={resetLlmSettings}
              className="text-sm text-blue-700 hover:underline"
            >
              すべて標準に戻す
            </button>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {LLM_FEATURES.map((f) => {
            const s = settings[f.id];
            const avg = averageCost(f.id, s.model);
            return (
              <div key={f.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {f.label}
                      {!isDefault(f.id) && (
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-normal text-blue-700">
                          変更中
                        </span>
                      )}
                    </p>
                  </div>
                  {avg !== undefined && (
                    <p className="text-xs text-gray-500">
                      これまでの 1 回あたり {formatUsd(avg)}
                    </p>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[3fr_4fr]">
                  <Segmented
                    label="モデル"
                    value={s.model}
                    options={MODEL_OPTIONS}
                    onChange={(model) => change(f.id, { model })}
                  />
                  <Segmented
                    label="エフォート"
                    value={s.effort}
                    options={EFFORT_OPTIONS}
                    onChange={(effort) => change(f.id, { effort })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">使用量</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat
            label="今日の料金の目安"
            value={formatUsd(today.total.costUsd)}
          />
          <Stat
            label="今日 AI を呼んだ回数"
            value={`${fmt(today.total.calls)} 回`}
          />
          <Stat
            label={`直近 ${KEEP_DAYS} 日の料金の目安`}
            value={formatUsd(all.total.costUsd)}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-800">
            機能・モデルごとの内訳
          </h3>
          <div className="w-56">
            <Segmented
              label="期間"
              hideLabel
              value={range}
              options={[
                { value: "today", label: "今日" },
                { value: "all", label: `直近 ${KEEP_DAYS} 日` },
              ]}
              onChange={setRange}
            />
          </div>
        </div>

        {shown.rows.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            {range === "today"
              ? "今日はまだ AI を呼んでいません。"
              : "まだ記録がありません。"}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">機能</th>
                  <th className="px-3 py-2 font-medium">モデル</th>
                  <th className="px-3 py-2 text-right font-medium">回数</th>
                  <th className="px-3 py-2 text-right font-medium">入力</th>
                  <th className="px-3 py-2 text-right font-medium">出力</th>
                  <th className="px-3 py-2 text-right font-medium">
                    キャッシュ
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    料金の目安
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((r) => (
                  <UsageLine
                    key={`${r.feature}|${r.model}`}
                    feature={
                      LLM_FEATURES.find((f) => f.id === r.feature)?.label ??
                      r.feature
                    }
                    model={modelLabel(r.model)}
                    t={r}
                  />
                ))}
                <UsageLine feature="合計" model="" t={shown.total} strong />
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <p>
            このブラウザでアプリが AI
            を呼んだ分です。料金は単価表から計算した目安で、正確な請求額は
            Anthropic の Console で確かめてください。
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "記録した使用量をすべて消します。よろしいですか？",
                )
              )
                resetUsage();
            }}
            className="shrink-0 text-red-600 hover:underline"
          >
            使用量の記録を消す
          </button>
        </div>
      </section>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("ja-JP");

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
        {value}
      </p>
    </div>
  );
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
    ? "border-t border-gray-300 bg-gray-50 font-medium"
    : "border-t border-gray-100";
  return (
    <tr className={cls}>
      <td className="px-3 py-2">{feature}</td>
      <td className="px-3 py-2 text-gray-600">{model}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(t.calls)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmt(t.inputTokens)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmt(t.outputTokens)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmt(t.cacheReadTokens + t.cacheWriteTokens)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatUsd(t.costUsd)}
      </td>
    </tr>
  );
}
