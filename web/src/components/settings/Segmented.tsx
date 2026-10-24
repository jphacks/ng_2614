"use client";

// いくつかの選択肢から1つを選ぶトグル（ラジオボタンの代わり）。設定画面（S-8）で使う

type Option<T extends string> = {
  value: T;
  label: string;
  sub?: string; // ラベルの下に小さく出す補足
};

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
}: {
  label: string;
  hideLabel?: boolean; // 見出しを画面に出さない（読み上げには残す）
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      {!hideLabel && <p className="mb-1 text-xs text-gray-500">{label}</p>}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex w-full rounded-lg bg-gray-100 p-1"
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-md px-2 py-1.5 text-center text-sm transition-colors ${
                selected
                  ? "bg-white font-medium text-blue-700 shadow-sm ring-1 ring-blue-200"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className="block leading-tight">{o.label}</span>
              {o.sub && (
                <span
                  className={`block text-[11px] leading-tight ${selected ? "text-blue-600" : "text-gray-400"}`}
                >
                  {o.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
