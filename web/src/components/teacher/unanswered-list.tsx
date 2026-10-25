import type { TeacherItem, TeacherSession } from "@/lib/types";
import { Conversation } from "./conversation";
import type { TeacherLook } from "./teacher-avatar";
import { LayerBadge } from "./layer-badge";
import { ViewpointList } from "./viewpoint-list";

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

export function UnansweredList({
  misses,
  teacher,
}: {
  misses: UnderstoodMiss[];
  teacher?: TeacherLook;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">答えられなかった点</h2>
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
              {/* turns が無い古い記録も、質問・回答・フィードバックを同じ先生のやりとりとして出す。最後の先生の発言が講評 */}
              <div className="mt-3">
                <Conversation
                  turns={
                    item.turns ?? [
                      { role: "teacher", text: item.question },
                      { role: "student", text: item.answer },
                      { role: "teacher", text: item.feedback },
                    ]
                  }
                  teacher={teacher}
                />
              </div>
              {item.viewpoints && (
                <div className="mt-3">
                  <ViewpointList
                    viewpoints={item.viewpoints}
                    covered={item.covered ?? []}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
