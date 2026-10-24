// 画面ごとの本文の幅（設計書「7. 画面・UX」の「画面の幅」）。
// 全体の枠（layout.tsx の main）は最大 1536px。読みものと入力の画面は、1行が長すぎないよう狭める

const WIDTH = {
  reading: "max-w-4xl", // 896px：S-2、S-5、S-6、S-8、S-9
  medium: "max-w-6xl", // 1152px：S-3
} as const;

export function PageWidth({
  size,
  children,
}: {
  size: keyof typeof WIDTH;
  children: React.ReactNode;
}) {
  return <div className={`mx-auto ${WIDTH[size]}`}>{children}</div>;
}
