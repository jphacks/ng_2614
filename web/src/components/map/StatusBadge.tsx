import type { MapStatus } from "@/lib/types";
import { STATUS_BADGE } from "./labels";

export function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: MapStatus;
}) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {label}
    </span>
  );
}
