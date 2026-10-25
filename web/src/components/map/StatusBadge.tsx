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
      className={`tag ${STATUS_BADGE[status]}`}
    >
      {label}
    </span>
  );
}
