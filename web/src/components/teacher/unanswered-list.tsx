import type { TeacherItem, TeacherSession } from "@/lib/types";
import { Conversation } from "./conversation";
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

export function UnansweredList({ misses }: { misses: UnderstoodMiss[] }) {
  return (
    <section className="mt-10">
      <h2 className="rule-head text-lg font-bold">答えられなかった点</h2>
      {misses.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">まだ記録はありません。</p>
      ) : (
        // 先生の添削の書き込みのように、赤ペンの番号を振って罫線で区切る
        <ol className="divide-y divide-hair">
          {misses.map(({ sessionId, createdAt, item }, i) => (
            <li key={`${sessionId}-${i}`} className="flex gap-3 py-4">
              <span
                aria-hidden="true"
                className="w-6 shrink-0 font-hand text-lg leading-6 text-pen"
              >
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LayerBadge layer={item.layer} />
                  <span className="text-xs text-ink-3">
                    {formatDate(createdAt)}
                  </span>
                </div>
                {item.turns ? (
                  <div className="mt-3">
                    {/* 最後の先生の発言は講評なので、下に分けて出す */}
                    <Conversation turns={item.turns.slice(0, -1)} />
                  </div>
                ) : (
                  <>
                    <p className="pen-note mt-2 text-[15px]">{item.question}</p>
                    <p className="mt-2 text-sm text-ink">
                      <span className="font-medium">あなたの回答：</span>
                      <span className="whitespace-pre-wrap">{item.answer}</span>
                    </p>
                  </>
                )}
                <p className="mt-3 text-sm">
                  <span className="font-medium text-ink-2">
                    {item.turns ? "講評：" : "先生のフィードバック："}
                  </span>
                  <span className="pen-note whitespace-pre-wrap text-[15px]">
                    {item.feedback}
                  </span>
                </p>
                {item.viewpoints && (
                  <div className="mt-3">
                    <ViewpointList
                      viewpoints={item.viewpoints}
                      covered={item.covered ?? []}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
