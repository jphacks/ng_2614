// 作業フローマップの帯（F-15）の大きさ。帯の部品と親（MapStrip、layout）で同じ値を使う。

// 縦（右のサイドバー）を畳んだときの幅（px）。本文はこの分だけ右側を空ける。
// 開いたときの幅は見る人が変えられる（lib/map/prefs.ts の useSideWidth、SIDE_OPEN_WIDTH）。
// 本文が空けるのは初期の幅（SIDE_OPEN_WIDTH.initial）までで、広げた分は本文の上に重ねる
export const SIDE_WIDTH = { collapsed: 48 } as const;

// 縦を使える画面の幅。これより狭いときは、縦を選んでいても横で出す
export const WIDE_QUERY = "(min-width: 768px)";

// 本文の右側を空ける幅を伝える CSS 変数（document.documentElement に付ける）
export const SIDE_WIDTH_VAR = "--map-side-w";
