// research-workspace（F-15）のファイルを読み取る。副作用のない関数だけを置く（サーバー側で使う）。
// 形式は https://github.com/haruto2919/research-workspace の .research/lab/AGENTS.md と .research/secretary/AGENTS.md に従う。
// 【担当：サブエージェント A。シグネチャはルート（B）と AI（C）が使うので変えない】

import type { SourceKind } from "@/lib/types";

export type WorkspaceFile = { path: string; text: string };

// frontmatter の値。`key: value` は文字列、`key: [a, b]` は文字列の配列
export type FrontmatterValue = string | string[];

export type WorkspaceDoc = {
  path: string; // リポジトリのルートからのパス
  kind: SourceKind; // "commit" と "todo" にはならない
  date?: string; // frontmatter の date、無ければファイル名の先頭の YYYY-MM-DD
  title: string; // 最初の # 見出し。無ければファイル名
  frontmatter: Record<string, FrontmatterValue>;
  project?: string; // frontmatter の project
  status?: string; // frontmatter の status
  approval?: string; // frontmatter の approval
  links: string[]; // frontmatter の spec・source_brainstorm・implementation_verification・evidence・related_spec を、リポジトリのルートからのパスにしたもの
  commits: string[]; // frontmatter の base_commit・implementation_reference_commit（小文字）
  implementationRepo?: string; // implementation_repository か research_repository（"owner/name"）
  codeState?: string; // code_state
  headings: string[]; // ## と ### の見出し（順番どおり、最大30）
  excerpt: string; // 本文の要点。「結論」「目的」「出発点」などの節があればその冒頭、無ければ本文の冒頭。最大600文字
};

export type ParsedMilestone = { title: string; done: boolean };

const LAB_PREFIX = ".research/lab/projects/";
const BRAINSTORM_PREFIX = ".research/secretary/notes/brainstorm/";

// プロジェクトの下で読むフォルダと、その出典の種類
const KIND_BY_FOLDER: Record<string, SourceKind> = {
  specs: "spec",
  experiments: "experiment",
  meetings: "meeting",
  materials: "material",
  papers: "paper",
};

// 途中にあれば読まないフォルダ（図は画像のはずだが、念のため）
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(["code-analysis", "references", "figures"]);

const LINK_KEYS = [
  "spec",
  "source_brainstorm",
  "implementation_verification",
  "evidence",
  "related_spec",
] as const;
const COMMIT_KEYS = ["base_commit", "implementation_reference_commit"] as const;

const MAX_HEADINGS = 30;
const MAX_EXCERPT_CHARS = 600;

// 抜粋に使う節の見出しの語。前にあるものを優先する
const EXCERPT_KEYWORDS = ["結論", "目的", "出発点", "概要", "要旨"];

type PathClass = { kind: SourceKind | "readme"; brainstorm: boolean };

// パスを分類する。読む対象でなければ undefined
function classifyPath(path: string, project: string): PathClass | undefined {
  if (!/\.md$/i.test(path)) return undefined;
  if (project && path.startsWith(`${LAB_PREFIX}${project}/`)) {
    const segments = path.slice(`${LAB_PREFIX}${project}/`.length).split("/");
    if (segments.length === 1) {
      return segments[0] === "README.md" ? { kind: "readme", brainstorm: false } : undefined;
    }
    const kind = KIND_BY_FOLDER[segments[0]];
    if (!kind) return undefined;
    if (segments.slice(0, -1).some((s) => SKIPPED_FOLDERS.has(s))) return undefined;
    return { kind, brainstorm: false };
  }
  if (path.startsWith(BRAINSTORM_PREFIX)) {
    const segments = path.slice(BRAINSTORM_PREFIX.length).split("/");
    if (segments.slice(0, -1).some((s) => SKIPPED_FOLDERS.has(s))) return undefined;
    return { kind: "brainstorm", brainstorm: true };
  }
  return undefined;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

// ファイル名の先頭の YYYY-MM-DD
function dateFromName(path: string): string | undefined {
  return /^(\d{4}-\d{2}-\d{2})/.exec(basename(path))?.[1];
}

// 読む対象の候補を返す（GitHub のツリーの全パスから）。
// - .research/lab/projects/<project>/ の README.md・specs/・experiments/・meetings/・materials/・papers/ の .md
// - .research/secretary/notes/brainstorm/ の .md（project が一致するかは、読んだあと parseDoc の結果で判断する）
// - code-analysis/・references/・figures/・画像・.gitkeep は読まない
// 並びは、ファイル名の日付が新しい順（日付の無いものは最後）。README.md は常に先頭
//
// この実装で決めたこと：README.md はプロジェクト直下のものだけ（壁打ちの README.md は普通のファイル扱い）。
// フォルダの下の入れ子（experiments/foo/x.md など）も読む。日付が同じ・無いものはパスの昇順
export function selectWorkspacePaths(allPaths: string[], project: string): string[] {
  const seen = new Set<string>();
  const readme: string[] = [];
  const others: { path: string; date?: string }[] = [];
  for (const path of allPaths) {
    if (seen.has(path)) continue;
    const cls = classifyPath(path, project);
    if (!cls) continue;
    seen.add(path);
    if (cls.kind === "readme") readme.push(path);
    else others.push({ path, date: dateFromName(path) });
  }
  others.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return [...readme, ...others.map((o) => o.path)];
}

// "..." / '...' の引用符を外す
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0]) {
    return t.slice(1, -1);
  }
  return t;
}

// 値が null（null・~・空）なら undefined
function parseScalar(raw: string): string | undefined {
  const t = raw.trim();
  if (t[0] === '"' || t[0] === "'") {
    const value = unquote(t);
    return value === "" ? undefined : value;
  }
  // 引用符なしの値の後ろの " # コメント" は落とす
  const value = t.replace(/\s+#.*$/, "").trim();
  if (value === "" || value === "null" || value === "~") return undefined;
  return value;
}

// `[a, b, "c, d"]` の中身を分ける（引用符の中のカンマは区切りにしない）
function parseInlineArray(inner: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      items.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map((s) => unquote(s)).filter((s) => s !== "");
}

// frontmatter（先頭の --- と --- の間）を読む。無ければ data は空で、body はテキスト全体
//
// この実装で決めたこと：読めるのは `key: value`・`key: [a, b]`・`key:` の次の行からの `- a` の並び・引用符付きの値。
// 値が null・~・空のキーは data に入れない。閉じの --- が無ければ frontmatter は無いものとする
export function parseFrontmatter(text: string): {
  data: Record<string, FrontmatterValue>;
  body: string;
} {
  const source = text.replace(/^﻿/, "");
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trimEnd() !== "---") return { data: {}, body: text };
  const end = lines.findIndex((line, i) => i > 0 && line.trimEnd() === "---");
  if (end < 0) return { data: {}, body: text };

  const data: Record<string, FrontmatterValue> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line) || /^\s/.test(line)) continue;
    const m = /^([^\s:#][^:]*?):(?:\s+(.*))?$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const raw = (m[2] ?? "").trim();
    if (raw === "") {
      // 次の行からの `- a` の並び
      const items: string[] = [];
      while (i + 1 < end && /^\s*-\s+/.test(lines[i + 1])) {
        i++;
        const item = parseScalar(lines[i].replace(/^\s*-\s+/, ""));
        if (item !== undefined) items.push(item);
      }
      if (items.length > 0) data[key] = items;
      continue;
    }
    if (raw.startsWith("[") && raw.endsWith("]")) {
      data[key] = parseInlineArray(raw.slice(1, -1));
      continue;
    }
    const value = parseScalar(raw);
    if (value !== undefined) data[key] = value;
  }
  return { data, body: lines.slice(end + 1).join("\n") };
}

type BodyLine = { text: string; heading?: { level: number; text: string } };

// 本文を行に分ける。コードブロックの中の # は見出しにしない
function scanBody(body: string): BodyLine[] {
  const result: BodyLine[] = [];
  let fence: string | undefined;
  for (const text of body.split(/\r?\n/)) {
    const fenceMark = /^\s*(```|~~~)/.exec(text)?.[1];
    if (fenceMark) {
      if (!fence) fence = fenceMark;
      else if (fence === fenceMark) fence = undefined;
      result.push({ text });
      continue;
    }
    const m = fence ? null : /^(#{1,6})\s+(.+?)\s*$/.exec(text);
    result.push(m ? { text, heading: { level: m[1].length, text: m[2] } } : { text });
  }
  return result;
}

function firstString(value: FrontmatterValue | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t === "" ? undefined : t;
}

function asList(value: FrontmatterValue | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((s) => s.trim()).filter((s) => s !== "");
}

// ドキュメント自身のパスを基準に、相対パスをリポジトリのルートからのパスにする。
// URL・.md でないもの・ルートより上に出るものは undefined
function resolveLink(docPath: string, target: string): string | undefined {
  let t = target.trim().replace(/^`|`$/g, "");
  t = t.replace(/[#?].*$/, "");
  if (!t || t.includes("://") || !/\.md$/i.test(t)) return undefined;
  const parts = t.startsWith("/") ? [] : docPath.split("/").slice(0, -1);
  for (const seg of t.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.length > 0 ? parts.join("/") : undefined;
}

function truncate(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

// 空行を除いて行をつなぎ、最大文字数で切る
function compact(lines: string[]): string {
  return truncate(
    lines
      .map((l) => l.trim())
      .filter((l) => l !== "")
      .join("\n"),
    MAX_EXCERPT_CHARS,
  );
}

function buildExcerpt(lines: BodyLine[]): string {
  for (const keyword of EXCERPT_KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].heading;
      if (!h || h.level < 2 || h.level > 3 || !h.text.includes(keyword)) continue;
      const section: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].heading;
        if (next && next.level <= 3) break;
        section.push(lines[j].text);
      }
      const excerpt = compact(section);
      if (excerpt) return excerpt;
    }
  }
  // 節が無ければ本文の冒頭（最初の # のタイトル行は除く）
  const titleIndex = lines.findIndex((l) => l.heading?.level === 1);
  return compact(lines.filter((_, i) => i !== titleIndex).map((l) => l.text));
}

function normalizeRepo(value: string): string | undefined {
  const t = value
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(t) ? t : undefined;
}

// 1つのファイルを読む。README.md や対象外のファイル、壁打ちで project が別のものは undefined
//
// この実装で決めたこと：壁打ちは frontmatter の project が無い場合も対象外。
// links は .md のパスだけ（URL や "none" などは入れない）で、重複は除く。
// commits は 7〜40桁の16進数だけ（小文字にする）。frontmatter の null・空の値は無いものとして扱う
export function parseDoc(file: WorkspaceFile, project: string): WorkspaceDoc | undefined {
  const cls = classifyPath(file.path, project);
  if (!cls || cls.kind === "readme") return undefined;
  const { data, body } = parseFrontmatter(file.text);
  const docProject = firstString(data.project);
  if (cls.brainstorm && docProject !== project) return undefined;

  const lines = scanBody(body);
  const title =
    lines.find((l) => l.heading?.level === 1)?.heading?.text ??
    basename(file.path).replace(/\.md$/i, "");

  const links: string[] = [];
  for (const key of LINK_KEYS) {
    for (const value of asList(data[key])) {
      const resolved = resolveLink(file.path, value);
      if (resolved && !links.includes(resolved)) links.push(resolved);
    }
  }

  const commits: string[] = [];
  for (const key of COMMIT_KEYS) {
    for (const value of asList(data[key])) {
      const sha = value.toLowerCase();
      if (/^[0-9a-f]{7,40}$/.test(sha) && !commits.includes(sha)) commits.push(sha);
    }
  }

  const repoValue = firstString(data.implementation_repository) ?? firstString(data.research_repository);

  return {
    path: file.path,
    kind: cls.kind,
    date: firstString(data.date) ?? dateFromName(file.path),
    title,
    frontmatter: data,
    project: docProject,
    status: firstString(data.status),
    approval: firstString(data.approval),
    links,
    commits,
    implementationRepo: repoValue ? normalizeRepo(repoValue) : undefined,
    codeState: firstString(data.code_state),
    headings: lines
      .filter((l) => l.heading && (l.heading.level === 2 || l.heading.level === 3))
      .map((l) => l.heading!.text)
      .slice(0, MAX_HEADINGS),
    excerpt: buildExcerpt(lines),
  };
}

// README.md の「## マイルストーン」の節のチェックボックス（- [ ] / - [x]）を読む
//
// この実装で決めたこと：「マイルストーン」を含む ## 見出しの節（次の # か ## まで）。
// 入れ子のチェックボックスも読む。* のリストも可。title は前後の空白を除いたもの
export function parseMilestones(readmeText: string): ParsedMilestone[] {
  const lines = scanBody(parseFrontmatter(readmeText).body);
  const start = lines.findIndex((l) => l.heading?.level === 2 && l.heading.text.includes("マイルストーン"));
  if (start < 0) return [];
  const result: ParsedMilestone[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].heading;
    if (h && h.level <= 2) break;
    const m = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(lines[i].text);
    if (m) result.push({ title: m[2], done: m[1] !== " " });
  }
  return result;
}
