// 画面で使う表示用の小さな関数

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function firstLine(text: string): string {
  return text.split("\n")[0] ?? "";
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
