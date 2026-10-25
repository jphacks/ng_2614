import type { DiffFile } from "@/lib/api-types";
import type { Finding, FindingType } from "@/lib/types";
import { FindingDiffs } from "./DiffView";
import { FileList } from "./FileList";
import { FindingTypeSelect } from "./FindingTypeSelect";
import { circled } from "./labels";

// 判定の各項目（設計書「画面の見た目」）。隠れた問題だけ、左の余白に赤ペンの番号と縦線を付け、
// 画面を開いたときに赤ペンの線を引く（この画面でただ一つの動き）。余計な追加は空、目的どおりは若葉の線だけ

type Props = {
  finding: Finding;
  no: number; // 隠れた問題の番号（1 から）。ほかの種類では使わない
  diffFiles: DiffFile[]; // この項目に関係するファイルの差分（F-14）
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
    <div className="sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4">
      <dt className="flex items-center gap-2 self-start text-xs font-bold text-ink-2 sm:pt-0.5">
        {label}
      </dt>
      <dd className="mt-0.5 max-w-[46em] whitespace-pre-wrap text-sm leading-relaxed text-ink sm:mt-0">
        {children}
      </dd>
    </div>
  );
}

// 隠れた問題の左の余白：赤ペンの番号と、上から引く縦線
function PenMargin({ no }: { no: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col items-end gap-2">
      <span className="font-hand text-2xl leading-none text-pen">{circled(no)}</span>
      <span
        className="pen-stroke w-0.5 flex-1 bg-pen"
        style={{ animationDelay: `${(no - 1) * 160}ms` }}
      />
    </div>
  );
}

// ほかの種類の左の余白：色の線だけ（番号は振らない）
function RuleMargin({ tone }: { tone: "sky" | "mint" }) {
  return (
    <div aria-hidden="true" className="flex justify-end">
      <span className={`w-0.5 ${tone === "sky" ? "bg-sky" : "bg-mint"}`} />
    </div>
  );
}

function HiddenProblemCard({
  finding,
  no,
  diffFiles,
  onChangeType,
  onToggleSaved,
}: Props) {
  const impact = finding.researchImpact;
  const saved = finding.saved === true;
  return (
    <article
      aria-label={`指摘 ${no}`}
      className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-5"
    >
      <PenMargin no={no} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-base leading-relaxed">
            {finding.summary}
          </h3>
          <button
            type="button"
            onClick={() => onToggleSaved(!saved)}
            aria-pressed={saved}
            className={`shrink-0 ${saved ? "btn btn-sm" : "btn-pen btn-sm"}`}
          >
            {saved ? "保存済み（取り消す）" : "問題ログに保存"}
          </button>
        </div>

        <dl className="mt-3 space-y-2.5">
          {finding.error && (
            <Field
              label={
                <>
                  エラー内容
                  {finding.errorIsInferred && (
                    <span className="marker text-[11px] font-medium">推測</span>
                  )}
                </>
              }
            >
              {finding.error}
            </Field>
          )}
          {finding.fix && <Field label="対処方法">{finding.fix}</Field>}
          {impact && (
            <Field
              label={
                <span className={impact.exists ? "text-pen" : undefined}>
                  研究への影響
                </span>
              }
            >
              {impact.exists ? (
                <span className="font-bold text-pen">あり。</span>
              ) : (
                <span className="text-ink-2">なし。</span>
              )}
              {impact.description && (
                <span
                  className={
                    impact.exists
                      ? "underline decoration-pen/45 decoration-wavy decoration-1 underline-offset-[5px]"
                      : undefined
                  }
                >
                  {impact.description}
                </span>
              )}
            </Field>
          )}
        </dl>

        <div className="mt-3 space-y-2">
          <FileList files={finding.files} />
          <FindingDiffs files={diffFiles} pen />
        </div>

        <div className="mt-3 flex justify-end">
          <FindingTypeSelect value={finding.type} onChange={onChangeType} />
        </div>
      </div>
    </article>
  );
}

function ExtraAdditionCard({ finding, diffFiles, onChangeType }: Props) {
  return (
    <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-4">
      <RuleMargin tone="sky" />
      <div className="min-w-0">
        <span className="tag text-sky-ink">頼んでいない追加</span>
        <p className="mt-2 max-w-[46em] whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {finding.summary}
        </p>
        <div className="mt-2 space-y-2">
          <FileList files={finding.files} />
          <FindingDiffs files={diffFiles} />
        </div>
        <div className="mt-3 flex justify-end">
          <FindingTypeSelect value={finding.type} onChange={onChangeType} />
        </div>
      </div>
    </article>
  );
}

function OnPurposeCard({ finding, diffFiles, onChangeType }: Props) {
  return (
    <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-3 text-ink-2">
      <RuleMargin tone="mint" />
      <div className="min-w-0">
        <p className="max-w-[46em] whitespace-pre-wrap text-sm leading-relaxed">{finding.summary}</p>
        <div className="mt-2 space-y-2">
          <FileList files={finding.files} />
          <FindingDiffs files={diffFiles} />
        </div>
        <div className="mt-2 flex justify-end">
          <FindingTypeSelect value={finding.type} onChange={onChangeType} />
        </div>
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
