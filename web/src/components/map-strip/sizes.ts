// 作業フローマップの帯（F-15）の大きさ。帯の部品と親（MapStrip、layout）で同じ値を使う。

// 縦（右のサイドバー）の幅（px）。本文はこの分だけ右側を空ける
export const SIDE_WIDTH = { collapsed: 48, open: 208 } as const;

// 縦を使える画面の幅。これより狭いときは、縦を選んでいても横で出す
export const WIDE_QUERY = "(min-width: 768px)";

// 本文の右側を空ける幅を伝える CSS 変数（document.documentElement に付ける）
export const SIDE_WIDTH_VAR = "--map-side-w";
