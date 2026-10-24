import Link from "next/link";
import type { FindingType, Review } from "@/lib/types";
import { headline } from "@/components/review/labels";
import { firstLine, formatDate, shortSha } from "./format";

const TYPE_LABELS: { type: FindingType; label: string; className: string }[] = [
  {
    type: "on_purpose",
    label: "目的どおり",
    className: "bg-green-100 text-green-800",
  },
  {
    type: "hidden_problem",
    label: "隠れた問題",
    className: "bg-red-100 text-red-800",
  },
  {
    type: "extra_addition",
    label: "余計な追加",
    className: "bg-yellow-100 text-yellow-800",
  },
];

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        まだ変更を取り込んでいません。「変更を取り込む」から始めてください。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {reviews.map((review) => {
        const isHook = review.source === "claude_code_hook";
        return (
          <li key={review.id}>
            <Link
              href={`/reviews/${review.id}`}
              className="block rounded-md border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50"
            >
              <p className="text-sm font-medium text-gray-900">
                {isHook
                  ? headline(review.purpose) || "（依頼文なし）"
                  : firstLine(review.commitMessage) ||
                    "(コミットメッセージなし)"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(review.createdAt)}
                <span className="mx-2">・</span>
                {isHook ? (
                  "Claude Code の作業"
                ) : (
                  <span className="font-mono">
                    {shortSha(review.commitSha)}
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TYPE_LABELS.map(({ type, label, className }) => (
                  <span
                    key={type}
                    className={`rounded px-2 py-0.5 text-xs ${className}`}
                  >
                    {label}{" "}
                    {review.findings.filter((f) => f.type === type).length}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
