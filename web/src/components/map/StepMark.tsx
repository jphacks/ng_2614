// レーン（工程）の番号の丸（F-15）。サブタスクが全部済んだレーンは若葉の ✓、今の段階は藍、ほかは番号。
// S-7 のレーン名と、縦の帯のステッププログレスバーで使う

export function StepMark({
  index,
  complete,
  current,
  className = "",
}: {
  index: number; // 0 から数えた工程の順
  complete: boolean; // サブタスクが全部済んだ
  current: boolean; // 今の段階
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold ${
        complete
          ? "border-mint bg-mint text-paper"
          : current
            ? "border-accent bg-accent text-paper"
            : "border-hair bg-paper text-ink-3"
      } ${className}`}
    >
      {complete ? "✓" : index + 1}
    </span>
  );
}
