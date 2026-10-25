// 先生モードで、学生（あなた）の吹き出しに付ける丸いアイコン。先生のアイコン（TeacherAvatar）と同じ大きさ・形にする

export function StudentAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-deep"
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="currentColor"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
    </span>
  );
}
