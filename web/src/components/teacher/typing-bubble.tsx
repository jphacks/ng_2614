// 先生が返事を考えている間に出す「入力中」の吹き出し。先生の吹き出しと同じ見た目で、中身は点が3つ順番に跳ねる
import { TeacherAvatar, type TeacherLook } from "./teacher-avatar";

export function TypingBubble({ teacher }: { teacher: TeacherLook }) {
  return (
    <div
      role="status"
      aria-label={`${teacher.name}が考えています`}
      className="chat-appear flex items-start justify-start gap-2"
    >
      <TeacherAvatar teacher={teacher} />
      <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900">
        <span className="mb-0.5 block text-xs opacity-70">{teacher.name}</span>
        <span aria-hidden="true" className="flex h-5 items-center gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </div>
    </div>
  );
}
