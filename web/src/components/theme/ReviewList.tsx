import Link from "next/link";
import type { FindingType, Review } from "@/lib/types";
import { headline } from "@/components/review/labels";
import { firstLine, formatDate, shortSha } from "./format";

// 件数は札にせず文字で並べる。隠れた問題があるときだけ赤ペンにする
const TYPE_LABELS: { type: FindingType; label: string; className: string }[] = [
  {
    type: "on_purpose",
    label: "目的どおり",
    className: "text-mint-ink",
  },
  {
    type: "hidden_problem",
    label: "隠れた問題",
    className: "font-medium text-pen",
  },
  {
    type: "extra_addition",
    label: "余計な追加",
    className: "text-sky-ink",
  },
];

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="border border-dashed border-ink-3 p-4 text-sm text-ink-3">
        まだ変更が届いていません。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-hair border-y border-hair">
      {reviews.map((review) => {
        const isHook = review.source === "claude_code_hook";
        return (
          <li key={review.id}>
            <Link
              href={`/reviews/${review.id}`}
              className="block px-2 py-3 hover:bg-paper-2"
            >
              <p className="text-sm font-medium text-ink">
                {isHook
                  ? headline(review.purpose) || "（依頼文なし）"
                  : firstLine(review.commitMessage) ||
                    "(コミットメッセージなし)"}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3">
                <span>{formatDate(review.createdAt)}</span>
                {isHook ? (
                  <span>Claude Code の作業</span>
                ) : (
                  <span className="font-mono">
                    {shortSha(review.commitSha)}
                  </span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {TYPE_LABELS.map(({ type, label, className }) => {
                  const count = review.findings.filter(
                    (f) => f.type === type,
                  ).length;
                  return (
                    <span
                      key={type}
                      className={`text-xs ${count > 0 ? className : "text-ink-3"}`}
                    >
                      {label} {count}
                    </span>
                  );
                })}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
