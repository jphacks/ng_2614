// 先生のキャラクター（F-20）の丸いアイコン。画像が無いときは名前の頭文字を出す

export type TeacherLook = { name: string; image?: string };

export function TeacherAvatar({
  teacher,
  size = 32,
}: {
  teacher: TeacherLook;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (teacher.image) {
    return (
      // data URL の画像なので next/image は使わない
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={teacher.image}
        alt={teacher.name}
        style={style}
        className="shrink-0 rounded-full border border-hair object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.45 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-paper-2 font-bold text-ink-2"
    >
      {Array.from(teacher.name)[0] ?? "先"}
    </span>
  );
}
