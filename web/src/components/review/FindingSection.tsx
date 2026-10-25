import type { DiffResponse } from "@/lib/api-types";
import type { Finding, FindingType } from "@/lib/types";
import { FindingCard } from "./FindingCard";
import { FINDING_TYPE_LABEL } from "./labels";

type Props = {
  type: FindingType;
  findings: Finding[];
  diff?: DiffResponse | null; // 判定の差分（F-14）。無ければ差分は出さない
  onChangeType: (findingId: string, type: FindingType) => void;
  onToggleSaved: (findingId: string, saved: boolean) => void;
};

const TITLE_STYLE: Record<FindingType, string> = {
  hidden_problem: "text-xl text-ink",
  extra_addition: "text-lg text-ink",
  on_purpose: "text-base text-ink-2",
};

export function FindingSection({
  type,
  findings,
  diff,
  onChangeType,
  onToggleSaved,
}: Props) {
  return (
    <section>
      <h2 className={`rule-head ${TITLE_STYLE[type]}`}>
        {FINDING_TYPE_LABEL[type]}（{findings.length}）
      </h2>
      {findings.length === 0 ? (
        <p className="pt-3 text-sm text-ink-3">該当するものはありません。</p>
      ) : (
        <div className="divide-y divide-hair">
          {findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              no={i + 1}
              diffFiles={(diff?.files ?? []).filter((d) =>
                f.files.includes(d.filename),
              )}
              onChangeType={(t) => onChangeType(f.id, t)}
              onToggleSaved={(s) => onToggleSaved(f.id, s)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
