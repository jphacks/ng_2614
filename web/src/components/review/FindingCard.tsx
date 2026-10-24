import type { Finding, FindingType } from "@/lib/types";
import { FileList } from "./FileList";
import { FindingTypeSelect } from "./FindingTypeSelect";

type Props = {
  finding: Finding;
  onChangeType: (type: FindingType) => void;
  onToggleSaved: (saved: boolean) => void;
};

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-xs font-bold text-gray-600">
        {label}
      </h4>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
        {children}
      </p>
    </div>
  );
}

function HiddenProblemCard({ finding, onChangeType, onToggleSaved }: Props) {
  const impact = finding.researchImpact;
  const saved = finding.saved === true;
  return (
    <article className="rounded-lg border-2 border-red-300 bg-red-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-base font-bold text-gray-900">
          {finding.summary}
        </h3>
        <button
          type="button"
          onClick={() => onToggleSaved(!saved)}
          aria-pressed={saved}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium ${
            saved
              ? "border-green-600 bg-green-50 text-green-800"
              : "border-red-600 bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {saved ? "保存済み（取り消す）" : "問題ログに保存"}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {finding.error && (
          <Field
            label={
              <>
                エラー内容
                {finding.errorIsInferred && (
                  <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800">
                    推測
                  </span>
                )}
              </>
            }
          >
            {finding.error}
          </Field>
        )}
        {finding.fix && <Field label="対処方法">{finding.fix}</Field>}
        {impact && (
          <div
            className={`rounded-md border p-3 ${
              impact.exists
                ? "border-amber-400 bg-amber-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <h4
              className={`text-xs font-bold ${
                impact.exists ? "text-amber-800" : "text-gray-600"
              }`}
            >
              {impact.exists ? "⚠ 研究への影響：あり" : "研究への影響：なし"}
            </h4>
            {impact.description && (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
                {impact.description}
              </p>
            )}
          </div>
        )}
        <FileList files={finding.files} />
      </div>

      <div className="mt-3 flex justify-end">
        <FindingTypeSelect value={finding.type} onChange={onChangeType} />
      </div>
    </article>
  );
}

function ExtraAdditionCard({ finding, onChangeType }: Props) {
  return (
    <article className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-800">
        頼んでいない追加
      </span>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
        {finding.summary}
      </p>
      <div className="mt-2">
        <FileList files={finding.files} />
      </div>
      <div className="mt-3 flex justify-end">
        <FindingTypeSelect value={finding.type} onChange={onChangeType} />
      </div>
    </article>
  );
}

function OnPurposeCard({ finding, onChangeType }: Props) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 text-gray-600">
      <p className="whitespace-pre-wrap text-sm">{finding.summary}</p>
      <div className="mt-2">
        <FileList files={finding.files} />
      </div>
      <div className="mt-2 flex justify-end">
        <FindingTypeSelect value={finding.type} onChange={onChangeType} />
      </div>
    </article>
  );
}

export function FindingCard(props: Props) {
  switch (props.finding.type) {
    case "hidden_problem":
      return <HiddenProblemCard {...props} />;
    case "extra_addition":
      return <ExtraAdditionCard {...props} />;
    case "on_purpose":
      return <OnPurposeCard {...props} />;
  }
}
