import type { TeacherTurn } from "@/lib/types";

// 先生モードの1つの質問の中のやりとりを、紙に書いた問答の記録のように並べる。
// 先生の言葉は赤ペンの手書き、あなたの回答は墨のまま左に細い罫線を引く
export function Conversation({ turns }: { turns: TeacherTurn[] }) {
  return (
    <ul className="space-y-3">
      {turns.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={`w-10 shrink-0 pt-0.5 text-xs ${
              t.role === "teacher" ? "font-hand text-pen" : "text-ink-3"
            }`}
          >
            {t.role === "teacher" ? "先生" : "あなた"}
          </span>
          <p
            className={`min-w-0 flex-1 whitespace-pre-wrap ${
              t.role === "teacher"
                ? "pen-note text-[15px] leading-relaxed"
                : "border-l border-hair pl-3 text-sm text-ink"
            }`}
          >
            {t.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
