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
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          作業中に pull
          やブランチの切り替えがあったため、ほかの人の変更が混ざっている可能性があります。
        </p>
      )}

      {errors.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">作業中に起きたエラー</h2>
          <p className="text-sm text-gray-600">
            Claude Code が作業中に実際に出したエラーです（{errors.length}{" "}
            件）。コマンドが失敗したものと、コマンドは成功したが出力にエラーが出たもの（例外を捕まえて表示した、警告が出たなど）があります。
          </p>
          <ul className="space-y-2">
            {errors.map((e, i) => (
              <li
                key={i}
                className="space-y-1.5 rounded-lg border border-gray-200 p-3"
              >
                <p className="flex items-center gap-2 text-xs font-bold text-gray-600">
                  {e.tool}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                    {KIND_LABEL[e.kind ?? "failed"]}
                  </span>
                </p>
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

      {review.aiReport && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">AI の報告</h2>
          <p className="text-sm text-gray-600">
            作業を終えたときの Claude Code 自身の報告です。AI
            の自己申告なので、差分と合わせて確かめてください。
          </p>
          <details className="rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm text-blue-700">
              報告を読む
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {review.aiReport}
            </p>
          </details>
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
