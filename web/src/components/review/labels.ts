import type { FindingType } from "@/lib/types";

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  on_purpose: "目的どおり",
  hidden_problem: "隠れた問題",
  extra_addition: "余計な追加",
};

export const FINDING_TYPES: FindingType[] = [
  "on_purpose",
  "hidden_problem",
  "extra_addition",
];

export function firstLine(text: string): string {
  return text.split("\n")[0].trim();
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
