import type { TeacherItem, TeacherSession } from "@/lib/types";
import { LayerBadge } from "./layer-badge";

export type UnderstoodMiss = { sessionId: string; createdAt: string; item: TeacherItem };

// 過去の先生モードで、答えたが理解できていなかった質問を新しい順に取り出す
export function collectMisses(sessions: TeacherSession[]): UnderstoodMiss[] {
  return sessions.flatMap((s) =>
    s.items
      .filter((item) => !item.understood)
      .map((item) => ({ sessionId: s.id, createdAt: s.createdAt, item })),
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
}

export function UnansweredList({ misses }: { misses: UnderstoodMiss[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">答えられなかった点</h2>
      <p className="mt-1 text-sm text-gray-600">
        過去の先生モードで、まだ理解できていなかった質問です。ゼミの前に見直しましょう。
      </p>
      {misses.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">まだ記録はありません。</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {misses.map(({ sessionId, createdAt, item }, i) => (
            <li
              key={`${sessionId}-${i}`}
              className="rounded border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-center gap-2">
                <LayerBadge layer={item.layer} />
                <span className="text-xs text-gray-500">
                  {formatDate(createdAt)}
                </span>
              </div>
              <p className="mt-2 font-medium">{item.question}</p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-medium">あなたの回答：</span>
                <span className="whitespace-pre-wrap">{item.answer}</span>
              </p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-medium">先生のフィードバック：</span>
                <span className="whitespace-pre-wrap">{item.feedback}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
