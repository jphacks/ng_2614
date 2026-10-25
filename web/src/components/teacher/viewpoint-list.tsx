import type { Viewpoint } from "@/lib/types";

// 講評のあとに、先生が想定していた観点と、言えたかどうかを出す。
// 言えた観点には赤ペンの印、言えていない観点は控えめな灰色のまま
export function ViewpointList({
  viewpoints,
  covered,
}: {
  viewpoints: Viewpoint[];
  covered: string[];
}) {
  return (
    <div>
      <p className="text-xs font-bold text-ink-2">先生が想定していた観点</p>
      <ul className="mt-1 space-y-1 text-sm">
        {viewpoints.map((v) => {
          const ok = covered.includes(v.id);
          return (
            <li key={v.id} className="flex gap-2">
              <span
                className={`w-4 shrink-0 text-center ${
                  ok ? "font-hand font-bold text-pen" : "text-ink-3"
                }`}
                aria-label={ok ? "言えた" : "言えていない"}
              >
                {ok ? "✓" : "✗"}
              </span>
              <span className={ok ? "text-ink" : "text-ink-2"}>
                {v.text}
                {v.required && (
                  <span className="ml-1 text-xs text-ink-3">（必須）</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
