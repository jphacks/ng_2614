import { describe, expect, it } from "vitest";
import { parseDoc, parseFrontmatter, parseMilestones, selectWorkspacePaths } from "./parse";

const PROJECT = "sample-project";
const LAB = `.research/lab/projects/${PROJECT}`;
const BS = ".research/secretary/notes/brainstorm";

describe("selectWorkspacePaths", () => {
  const paths = [
    `${LAB}/experiments/2026-10-20-b.md`,
    `${LAB}/README.md`,
    `${LAB}/specs/2026-10-22-spec.md`,
    `${LAB}/experiments/2026-10-20-a.md`,
    `${LAB}/materials/notes-without-date.md`,
    `${LAB}/meetings/2026-10-15-mtg.md`,
    `${LAB}/papers/2026-09-01-paper.md`,
    `${BS}/2026-10-21-idea.md`,
    `${BS}/.gitkeep`,
    `${LAB}/experiments/.gitkeep`,
    `${LAB}/experiments/figures/plot.png`,
    `${LAB}/experiments/figures/notes.md`,
    `${LAB}/code-analysis/2026-10-23-audit.md`,
    `${LAB}/references/2026-10-23-ref.md`,
    `${LAB}/materials/figures/2026-10-23-diagram.png`,
    `.research/lab/projects/other-project/README.md`,
    `.research/lab/projects/other-project/specs/2026-10-23-x.md`,
    `.research/secretary/notes/other/2026-10-23-y.md`,
    "web/src/app/page.md",
    `${LAB}/README.md`,
  ];

  it("対象の .md だけを選び、README.md を先頭に、ファイル名の日付が新しい順に並べる", () => {
    expect(selectWorkspacePaths(paths, PROJECT)).toEqual([
      `${LAB}/README.md`,
      `${LAB}/specs/2026-10-22-spec.md`,
      `${BS}/2026-10-21-idea.md`,
      `${LAB}/experiments/2026-10-20-a.md`,
      `${LAB}/experiments/2026-10-20-b.md`,
      `${LAB}/meetings/2026-10-15-mtg.md`,
      `${LAB}/papers/2026-09-01-paper.md`,
      `${LAB}/materials/notes-without-date.md`,
    ]);
  });

  it("README.md が無ければ先頭は日付の新しいもの。別のプロジェクトは読まない", () => {
    const result = selectWorkspacePaths([`${LAB}/specs/2026-10-01-s.md`], "another");
    expect(result).toEqual([]);
    expect(selectWorkspacePaths([`${LAB}/specs/2026-10-01-s.md`], PROJECT)).toEqual([
      `${LAB}/specs/2026-10-01-s.md`,
    ]);
  });

  it("壁打ちの README.md は先頭に出さず、普通のファイルとして日付の無いものの並びに入る", () => {
    const result = selectWorkspacePaths(
      [`${BS}/README.md`, `${BS}/2026-10-01-a.md`, `${LAB}/README.md`],
      PROJECT,
    );
    expect(result).toEqual([`${LAB}/README.md`, `${BS}/2026-10-01-a.md`, `${BS}/README.md`]);
  });
});

describe("parseFrontmatter", () => {
  it("key: value、key: [a, b]、null、引用符付き、空行、コメントを読む", () => {
    const text = [
      "---",
      "project: sample-project",
      "",
      "status: draft",
      'title: "Spec: A vs B"',
      "alias: 'single quoted'",
      "participants: [教授, 学生A]",
      'tags: ["a, b", c]',
      "empty_list: []",
      "notion_url: null",
      "notion_export: ~",
      "blank:",
      "note: plain # comment",
      "# コメント行",
      "created: 2026-10-20",
      "---",
      "",
      "# 見出し",
      "本文",
    ].join("\n");
    const { data, body } = parseFrontmatter(text);
    expect(data).toEqual({
      project: "sample-project",
      status: "draft",
      title: "Spec: A vs B",
      alias: "single quoted",
      participants: ["教授", "学生A"],
      tags: ["a, b", "c"],
      empty_list: [],
      note: "plain",
      created: "2026-10-20",
    });
    expect(body).toBe("\n# 見出し\n本文");
  });

  it("key: の次の行からの - a の並びを配列にする", () => {
    const { data } = parseFrontmatter(["---", "evidence:", "  - ../a.md", "  - '../b.md'", "next: x", "---", "body"].join("\n"));
    expect(data).toEqual({ evidence: ["../a.md", "../b.md"], next: "x" });
  });

  it("CRLF と BOM を読める", () => {
    const { data, body } = parseFrontmatter("﻿---\r\nstatus: active\r\n---\r\n# T\r\n");
    expect(data).toEqual({ status: "active" });
    expect(body).toBe("# T\n");
  });

  it("frontmatter が無い・閉じていないときは data が空で、body は全体", () => {
    expect(parseFrontmatter("# タイトル\n本文")).toEqual({ data: {}, body: "# タイトル\n本文" });
    const open = "---\nstatus: x\n# タイトル";
    expect(parseFrontmatter(open)).toEqual({ data: {}, body: open });
  });
});

const SPEC_TEXT = [
  "---",
  `project: ${PROJECT}`,
  "spec_type: experiment",
  "status: implemented",
  "approval: approved",
  "title: \"A2 one-step parity\"",
  "created: 2026-10-20",
  "implementation_repository: https://github.com/example-org/impl-repo.git",
  "base_commit: ABCDEF1234567",
  "implementation_reference_commit: 0123456789abcdef0123456789abcdef01234567",
  "source_brainstorm: ../../../../secretary/notes/brainstorm/2026-10-19-idea.md",
  "implementation_verification: ../experiments/2026-10-20-verify.md",
  "evidence: [../experiments/2026-10-21-evidence.md, https://example.com/x.md, none]",
  "related_spec: ../specs/2026-10-18-older.md#section",
  "code_state: committed",
  "---",
  "",
  "# A2 spec",
  "",
  "## 背景",
  "",
  "背景の説明。",
  "",
  "## 目的",
  "",
  "1ステップだけ数値を比べる。",
  "",
  "二つ目の段落。",
  "",
  "### 条件",
  "",
  "```",
  "# コードの中の見出しは数えない",
  "```",
  "",
  "## 手順",
].join("\n");

describe("parseDoc", () => {
  const specPath = `${LAB}/specs/2026-10-20-a2.md`;

  it("spec の frontmatter・リンク・コミット・見出し・抜粋を読む", () => {
    const doc = parseDoc({ path: specPath, text: SPEC_TEXT }, PROJECT)!;
    expect(doc.path).toBe(specPath);
    expect(doc.kind).toBe("spec");
    expect(doc.date).toBe("2026-10-20");
    expect(doc.title).toBe("A2 spec");
    expect(doc.project).toBe(PROJECT);
    expect(doc.status).toBe("implemented");
    expect(doc.approval).toBe("approved");
    expect(doc.implementationRepo).toBe("example-org/impl-repo");
    expect(doc.codeState).toBe("committed");
    expect(doc.commits).toEqual([
      "abcdef1234567",
      "0123456789abcdef0123456789abcdef01234567",
    ]);
    expect(doc.links).toEqual([
      ".research/secretary/notes/brainstorm/2026-10-19-idea.md",
      `${LAB}/experiments/2026-10-20-verify.md`,
      `${LAB}/experiments/2026-10-21-evidence.md`,
      `${LAB}/specs/2026-10-18-older.md`,
    ]);
    expect(doc.headings).toEqual(["背景", "目的", "条件", "手順"]);
    expect(doc.excerpt).toBe("1ステップだけ数値を比べる。\n二つ目の段落。");
    expect(doc.frontmatter.spec_type).toBe("experiment");
  });

  it("frontmatter の date が優先で、無ければファイル名の日付。見出しが無ければファイル名がタイトル", () => {
    const withDate = parseDoc(
      { path: `${LAB}/experiments/2026-10-01-x.md`, text: "---\ndate: 2026-10-05\n---\n本文だけ" },
      PROJECT,
    )!;
    expect(withDate.date).toBe("2026-10-05");
    expect(withDate.title).toBe("2026-10-01-x");
    const noDate = parseDoc({ path: `${LAB}/experiments/2026-10-01-x.md`, text: "本文" }, PROJECT)!;
    expect(noDate.date).toBe("2026-10-01");
    const none = parseDoc({ path: `${LAB}/materials/memo.md`, text: "本文" }, PROJECT)!;
    expect(none.date).toBeUndefined();
    expect(none.kind).toBe("material");
  });

  it("節が無ければ本文の冒頭（タイトル行を除く）を最大600文字まで", () => {
    const long = "あ".repeat(700);
    const doc = parseDoc(
      { path: `${LAB}/meetings/2026-10-01-m.md`, text: `# 議事録\n\n${long}\n` },
      PROJECT,
    )!;
    expect(doc.kind).toBe("meeting");
    expect(doc.excerpt).toBe("あ".repeat(600));
  });

  it("見出しは最大30、## と ### だけ", () => {
    const text = ["# T", "#### 小", ...Array.from({ length: 40 }, (_, i) => `## H${i}`)].join("\n");
    const doc = parseDoc({ path: `${LAB}/papers/p.md`, text }, PROJECT)!;
    expect(doc.kind).toBe("paper");
    expect(doc.headings).toHaveLength(30);
    expect(doc.headings[0]).toBe("H0");
  });

  it("壁打ちは project が一致するものだけ", () => {
    const path = `${BS}/2026-10-19-idea.md`;
    const own = parseDoc(
      { path, text: `---\nproject: ${PROJECT}\nstatus: exploratory\n---\n# 壁打ち\n## 出発点\n問いは A。` },
      PROJECT,
    )!;
    expect(own.kind).toBe("brainstorm");
    expect(own.status).toBe("exploratory");
    expect(own.excerpt).toBe("問いは A。");
    expect(parseDoc({ path, text: "---\nproject: other\n---\n# x" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path, text: "# project の無い壁打ち" }, PROJECT)).toBeUndefined();
  });

  it("README.md・対象外のパス・別のプロジェクトは undefined", () => {
    expect(parseDoc({ path: `${LAB}/README.md`, text: "# R" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path: `${LAB}/references/x.md`, text: "# R" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path: `${LAB}/code-analysis/x.md`, text: "# R" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path: `${LAB}/experiments/figures/x.md`, text: "# R" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path: `${LAB}/experiments/x.csv`, text: "a,b" }, PROJECT)).toBeUndefined();
    expect(parseDoc({ path: `${LAB}/specs/x.md`, text: "# R" }, "another")).toBeUndefined();
  });

  it("ルートより上に出るリンクや、16進数でないコミットは入れない", () => {
    const doc = parseDoc(
      {
        path: `${LAB}/experiments/2026-10-01-x.md`,
        text: "---\nspec: ../../../../../../x.md\nbase_commit: none\nimplementation_reference_commit: [abc1234, zzzzzzz]\n---\n# X",
      },
      PROJECT,
    )!;
    expect(doc.links).toEqual([]);
    expect(doc.commits).toEqual(["abc1234"]);
  });
});

describe("parseMilestones", () => {
  it("「## マイルストーン」の節のチェックボックスだけを読む", () => {
    const text = [
      "---",
      "project: sample-project",
      "---",
      "# プロジェクト",
      "",
      "- [ ] 節の外のチェックボックス",
      "",
      "## マイルストーン",
      "",
      "- [x] ローダを整備する",
      "- [ ] LoRA を学習する",
      "  - [X] 入れ子の項目",
      "* [ ] * のリスト",
      "- 普通の項目",
      "",
      "```",
      "## コードの中",
      "```",
      "",
      "### 小見出し",
      "- [ ] 小見出しの下",
      "",
      "## 更新履歴",
      "- [x] 節の外",
    ].join("\n");
    expect(parseMilestones(text)).toEqual([
      { title: "ローダを整備する", done: true },
      { title: "LoRA を学習する", done: false },
      { title: "入れ子の項目", done: true },
      { title: "* のリスト", done: false },
      { title: "小見出しの下", done: false },
    ]);
  });

  it("節が無ければ空", () => {
    expect(parseMilestones("# R\n- [ ] x")).toEqual([]);
  });
});
