import type { Review } from "@/lib/types";

// フック（F-13）で届いた判定の、作業中のエラー・AI の最終報告・できたファイル・注意

const LONG_OUTPUT = 300;

const KIND_LABEL = {
  failed: "失敗したコマンド",
  in_output: "出力に出たエラー",
} as const;

export function HookReviewInfo({ review }: { review: Review }) {
  const errors = review.observedErrors ?? [];
  const files = review.generatedFiles ?? [];
  return (
    <>
      {review.headMoved && (
        <p className="text-sm">
          <span className="marker">
            作業中に pull
            やブランチの切り替えがあったため、ほかの人の変更が混ざっている可能性があります。
          </span>
        </p>
      )}

      {errors.length > 0 && (
        <section className="space-y-2">
          <h2 className="rule-head text-lg">作業中に起きたエラー</h2>
          <ul className="divide-y divide-hair">
            {errors.map((e, i) => (
              <li
                key={i}
                className="space-y-1.5 py-3"
              >
                <p className="flex items-center gap-2 font-mono text-xs font-bold text-ink-2">
                  {e.tool}
                  <span className="tag font-sans text-ink-2">
                    {KIND_LABEL[e.kind ?? "failed"]}
                  </span>
                </p>
                <pre className="whitespace-pre-wrap break-words bg-paper-2 p-2 font-mono text-xs text-ink">
                  {e.input}
                </pre>
                {e.output.length > LONG_OUTPUT ? (
                  <details>
                    <summary className="link cursor-pointer text-xs">
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

      {review.aiReport && (
        <section className="space-y-2">
          <h2 className="rule-head text-lg">
            AI の報告
            <span className="tag ml-2 font-sans text-ink-3">自己申告</span>
          </h2>
          <details>
            <summary className="link cursor-pointer text-sm">
              報告を読む
            </summary>
            <p className="mt-2 whitespace-pre-wrap border-l border-hair pl-3 text-sm text-ink">
              {review.aiReport}
            </p>
          </details>
        </section>
      )}

      {files.length > 0 && (
        <section className="space-y-2">
          <h2 className="rule-head text-lg">実行でできたファイル</h2>
          <p className="text-sm text-ink-2">中身は判定に送っていません。</p>
          <ul className="space-y-0.5 text-sm">
            {files.map((f) => (
              <li key={f} className="break-all font-mono text-xs text-ink">
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
    <pre className="whitespace-pre-wrap break-words border-l-2 border-pen bg-paper-2 p-2 font-mono text-xs text-ink">
      {text}
    </pre>
  );
}
