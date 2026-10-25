import type { TeacherTurn } from "@/lib/types";
import { StudentAvatar } from "./student-avatar";
import { TeacherAvatar, type TeacherLook } from "./teacher-avatar";

const DEFAULT_TEACHER: TeacherLook = { name: "先生" };

// 先生モードの1つの質問の中のやりとりを、チャットのように並べる。先生の吹き出しには先生のアイコンを付ける（F-20）。
// 先生の言葉は赤ペンの手書き風、あなたの回答は藍の吹き出し（設計書「画面の見た目」）
export function Conversation({
  turns,
  teacher = DEFAULT_TEACHER,
}: {
  turns: TeacherTurn[];
  teacher?: TeacherLook;
}) {
  return (
    <ul className="space-y-3">
      {turns.map((t, i) =>
        t.role === "teacher" ? (
          <li key={i} className="flex items-start justify-start gap-2">
            <TeacherAvatar teacher={teacher} />
            <div className="max-w-[85%] rounded-[6px] border border-hair bg-sheet px-3 py-2 font-hand text-[17px] leading-relaxed whitespace-pre-wrap text-pen">
              <span className="mb-0.5 block font-sans text-xs text-ink-3">{teacher.name}</span>
              {t.text}
            </div>
          </li>
        ) : (
          <li key={i} className="flex items-start justify-end gap-2">
            <div className="max-w-[85%] rounded-[6px] bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-white">
              <span className="mb-0.5 block text-xs opacity-70">あなた</span>
              {t.text}
            </div>
            <StudentAvatar />
          </li>
        ),
      )}
    </ul>
  );
}
