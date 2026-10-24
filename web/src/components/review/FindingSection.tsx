import type { Finding, FindingType } from "@/lib/types";
import { FindingCard } from "./FindingCard";
import { FINDING_TYPE_LABEL } from "./labels";

type Props = {
  type: FindingType;
  findings: Finding[];
  description: string;
  onChangeType: (findingId: string, type: FindingType) => void;
  onToggleSaved: (findingId: string, saved: boolean) => void;
};

const TITLE_STYLE: Record<FindingType, string> = {
  hidden_problem: "text-xl text-red-700",
  extra_addition: "text-base text-orange-800",
  on_purpose: "text-sm text-gray-600",
};

export function FindingSection({
  type,
  findings,
  description,
  onChangeType,
  onToggleSaved,
}: Props) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className={`font-bold ${TITLE_STYLE[type]}`}>
          {FINDING_TYPE_LABEL[type]}（{findings.length}）
        </h2>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {findings.length === 0 ? (
        <p className="text-sm text-gray-500">該当するものはありません。</p>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              onChangeType={(t) => onChangeType(f.id, t)}
              onToggleSaved={(s) => onToggleSaved(f.id, s)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
