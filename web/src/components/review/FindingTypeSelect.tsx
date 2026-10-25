import type { FindingType } from "@/lib/types";
import { FINDING_TYPES, FINDING_TYPE_LABEL } from "./labels";

type Props = {
  value: FindingType;
  onChange: (type: FindingType) => void;
};

// AI の判定が間違っているときに、ユーザーが分類を直すための小さなセレクト
export function FindingTypeSelect({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-3">
      判定を修正
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FindingType)}
        className="border border-ink-3 bg-paper px-1.5 py-0.5 text-xs text-ink"
      >
        {FINDING_TYPES.map((t) => (
          <option key={t} value={t}>
            {FINDING_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
    </label>
  );
}
