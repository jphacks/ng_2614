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
      {!hideLabel && <p className="mb-1 text-xs text-ink-3">{label}</p>}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex w-full border border-ink"
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
              className={`flex-1 border-l border-ink px-2 py-1.5 text-center text-sm transition-colors first:border-l-0 ${
                selected
                  ? "bg-accent font-medium text-paper"
                  : "bg-paper text-ink-2 hover:bg-paper-2 hover:text-ink"
              }`}
            >
              <span className="block leading-tight">{o.label}</span>
              {o.sub && (
                <span
                  className={`block text-[13px] leading-tight ${selected ? "text-paper/80" : "text-ink-3"}`}
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
