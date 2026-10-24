import type { Viewpoint } from "@/lib/types";

// 講評のあとに、先生が想定していた観点と、言えたかどうかを出す
export function ViewpointList({
  viewpoints,
  covered,
}: {
  viewpoints: Viewpoint[];
  covered: string[];
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600">先生が想定していた観点</p>
      <ul className="mt-1 space-y-1 text-sm">
        {viewpoints.map((v) => {
          const ok = covered.includes(v.id);
          return (
            <li key={v.id} className="flex gap-2">
              <span
                className={ok ? "text-green-700" : "text-amber-700"}
                aria-label={ok ? "言えた" : "言えていない"}
              >
                {ok ? "✓" : "✗"}
              </span>
              <span className={ok ? "text-gray-700" : "text-gray-900"}>
                {v.text}
                {v.required && (
                  <span className="ml-1 text-xs text-gray-500">（必須）</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
