import type { Review } from "@/lib/types";

// フック（F-13）で届いた判定の、作業中のエラー・できたファイル・注意

const LONG_OUTPUT = 300;

export function HookReviewInfo({ review }: { review: Review }) {
  const errors = review.observedErrors ?? [];
  const files = review.generatedFiles ?? [];
  return (
    <>
      {review.headMoved && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          作業中に pull
          やブランチの切り替えがあったため、ほかの人の変更が混ざっている可能性があります。
        </p>
      )}

      {errors.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">作業中に起きたエラー</h2>
          <p className="text-sm text-gray-600">
            Claude Code が実際に実行して失敗したものです（{errors.length} 件）。
          </p>
          <ul className="space-y-2">
            {errors.map((e, i) => (
              <li
                key={i}
                className="space-y-1.5 rounded-lg border border-gray-200 p-3"
              >
                <p className="text-xs font-bold text-gray-600">{e.tool}</p>
                <pre className="whitespace-pre-wrap break-words rounded bg-gray-50 p-2 font-mono text-xs text-gray-800">
                  {e.input}
                </pre>
                {e.output.length > LONG_OUTPUT ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-blue-700">
                      エラーの出力を見る
                    </summary>
                    <ErrorOutput text={e.output} />
                  </details>
                ) : (
                  <ErrorOutput text={e.output} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">実行でできたファイル</h2>
          <p className="text-sm text-gray-600">
            実験の出力などです。中身は判定に送っていません。
          </p>
          <ul className="space-y-0.5 text-sm">
            {files.map((f) => (
              <li key={f} className="break-all font-mono text-xs text-gray-800">
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ErrorOutput({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded bg-red-50 p-2 font-mono text-xs text-red-900">
      {text}
    </pre>
  );
}
