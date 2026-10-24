import type { TeacherTurn } from "@/lib/types";

// 先生モードの1つの質問の中のやりとりを、チャットのように並べる
export function Conversation({ turns }: { turns: TeacherTurn[] }) {
  return (
    <ul className="space-y-3">
      {turns.map((t, i) => (
        <li
          key={i}
          className={t.role === "teacher" ? "flex justify-start" : "flex justify-end"}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              t.role === "teacher"
                ? "bg-gray-100 text-gray-900"
                : "bg-blue-600 text-white"
            }`}
          >
            <span className="mb-0.5 block text-xs opacity-70">
              {t.role === "teacher" ? "先生" : "あなた"}
            </span>
            {t.text}
          </div>
        </li>
      ))}
    </ul>
  );
}
