#!/usr/bin/env node
// Claude Code のフック（UserPromptSubmit と Stop）から呼ばれ、
// AI が変えた差分・依頼文・エラーをアプリの受け取り箱（POST /api/hook/changes）に送る。
// 依存パッケージなし（Node.js 18 以上）。設計は docs/design.md の「Claude Code のフック（F-13）」。
//
// 守ること：
// - stdout には何も出さない（UserPromptSubmit の stdout は Claude の文脈に入ってしまう）
// - 何があっても exit 0。Claude Code の作業を止めない
// - 合言葉（RESEARCH_CHECK_TOKEN）の値は、ログにもエラーにも出さない

import { spawnSync } from "node:child_process";
import {
  existsSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---- 定数 ----

export const DEFAULT_URL = "http://localhost:3000";
export const POST_TIMEOUT_MS = 3_000;

// これを超えるファイルはスナップショットから外す
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DIFF_CHARS = 1_000_000;

export const MAX_PROMPTS_KEPT = 6;
export const MAX_EARLIER_PROMPTS = 5;
export const MAX_OUTBOX = 20;

export const MAX_OBSERVED_ERRORS = 10;
export const MAX_ERROR_INPUT_CHARS = 500;
export const MAX_ERROR_OUTPUT_CHARS = 2_000;

// 差分の中身を送らず、ファイル名だけ送る拡張子（実験の出力によくあるもの）
export const GENERATED_EXTENSIONS = [
  ".csv", ".tsv", ".log", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".pdf",
  ".pt", ".pth", ".ckpt", ".safetensors", ".bin", ".npy", ".npz", ".pkl",
  ".pickle", ".joblib", ".h5", ".hdf5", ".parquet", ".feather", ".arrow",
  ".onnx", ".tfevents",
];

export const MASK = "[伏せ字]";

// 差分の指定を引数で渡す上限。これを超えたら全体の差分から出力ファイルを除く指定に切り替える
const MAX_PATH_ARGS = 300;
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

// ---- 小さな道具 ----

function cap(text, max) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

// 長い出力は、最初と最後（スタックトレースの末尾が大事）を残して max 文字に収める
function capHeadTail(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  const mark = "\n…（中略）…\n";
  const room = max - mark.length;
  const head = Math.ceil(room / 2);
  return s.slice(0, head) + mark + s.slice(s.length - (room - head));
}

function warn(message) {
  // トークンは出さない。短い一行だけ
  try {
    process.stderr.write(`[research-check] ${message}\n`);
  } catch {
    // 何もしない
  }
}

function writeFileAtomic(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// ---- 設定（合言葉と URL） ----

// 簡単な dotenv の読み取り。コメント・引用符・export を扱う
export function parseDotenv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.indexOf(quote, 1) > 0) {
      value = value.slice(1, value.indexOf(quote, 1));
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    out[m[1]] = value;
  }
  return out;
}

// 環境変数を優先し、無ければこのリポジトリの web/.env.local から読む
export function loadConfig(env, scriptDir) {
  let fileValues = {};
  try {
    fileValues = parseDotenv(
      readFileSync(path.join(scriptDir, "..", "web", ".env.local"), "utf8"),
    );
  } catch {
    // ファイルが無ければ環境変数だけ
  }
  const pick = (name) => (env[name] ? env[name] : fileValues[name] || "");
  return {
    token: pick("RESEARCH_CHECK_TOKEN"),
    url: (pick("RESEARCH_CHECK_URL") || DEFAULT_URL).replace(/\/+$/, ""),
  };
}

// ---- 伏せ字 ----

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, MASK],
  [/sk-ant-[A-Za-z0-9_-]{10,}/g, MASK],
  [/sk-[A-Za-z0-9]{20,}/g, MASK],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, MASK],
  [/github_pat_[A-Za-z0-9_]{20,}/g, MASK],
  [/AKIA[0-9A-Z]{16}/g, MASK],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, MASK],
  // キー名は残して、値だけ伏せる
  [
    /(api[_-]?key|secret|token|password|passwd)(\s*[:=]\s*)["']?[^\s"']{8,}["']?/gi,
    `$1$2${MASK}`,
  ],
];

export function maskSecrets(text) {
  let s = String(text ?? "");
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// ---- git ----

function gitEnv(extra = {}) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...extra };
  if (!("GIT_INDEX_FILE" in extra)) delete env.GIT_INDEX_FILE;
  return env;
}

function git(args, { cwd, env, input } = {}) {
  const r = spawnSync("git", args, {
    cwd,
    env: env ?? gitEnv(),
    input,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout ?? "",
  };
}

function gitOut(args, opts) {
  const r = git(args, opts);
  return r.ok ? r.stdout.trim() : "";
}

// 今の HEAD。コミットがまだ無ければ ""
export function currentHead(root) {
  return gitOut(["rev-parse", "--verify", "-q", "HEAD"], { cwd: root });
}

// origin の URL から owner/name を求める（github.com の https / ssh / scp 形式）
export function parseRepo(remoteUrl) {
  const m = String(remoteUrl ?? "")
    .trim()
    .match(/github\.com[:/]([^/\s:]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : "";
}

export function isGeneratedFile(file) {
  const lower = file.toLowerCase();
  if (lower.includes("tfevents")) return true;
  return GENERATED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// 作業ツリーのスナップショット（git の tree）を作る。
// 本物のインデックスと作業ツリーには触らず、コピーしたインデックスで write-tree する。
// 1MB を超えるファイルは対象から外す（インデックスにある版のまま残る）。失敗したら null
export function takeSnapshot(root, stateDir) {
  mkdirSync(stateDir, { recursive: true });
  const tmpIndex = path.join(stateDir, `index.${process.pid}.tmp`);
  try {
    const realIndexRel = gitOut(["rev-parse", "--git-path", "index"], { cwd: root });
    const realIndex = realIndexRel ? path.resolve(root, realIndexRel) : "";
    // 新しいリポジトリではインデックスがまだ無い
    if (realIndex && existsSync(realIndex)) {
      copyFileSync(realIndex, tmpIndex);
      // コピーの更新時刻を本物のインデックスに合わせる。新しいままだと、同じ秒に同じ大きさで
      // 書き換えられたファイルを git が「変わっていない」と誤って判断してしまう（racy git）。
      // 少し古めにして、迷うときは中身を比べさせる
      const mtime = (statSync(realIndex).mtimeMs - 2) / 1000;
      utimesSync(tmpIndex, mtime, mtime);
    }

    const listed = git(
      ["ls-files", "-m", "-o", "-d", "--exclude-standard", "-z"],
      { cwd: root },
    );
    if (!listed.ok) return null;
    const files = [...new Set(listed.stdout.split("\0").filter(Boolean))].filter(
      (rel) => {
        try {
          const st = lstatSync(path.join(root, rel));
          if (st.isDirectory()) return false; // 入れ子の git リポジトリなど
          return st.size <= MAX_FILE_BYTES;
        } catch {
          return true; // 消えたファイルは残す（削除として記録する）
        }
      },
    );

    const env = gitEnv({ GIT_INDEX_FILE: tmpIndex });
    if (files.length > 0) {
      const added = git(
        ["add", "-A", "--pathspec-from-file=-", "--pathspec-file-nul"],
        {
          cwd: root,
          // ファイル名の * や [ を、パターンとして解釈させない
          env: { ...env, GIT_LITERAL_PATHSPECS: "1" },
          input: files.join("\0"),
        },
      );
      if (!added.ok) return null;
    }
    const tree = git(["write-tree"], { cwd: root, env });
    return tree.ok ? tree.stdout.trim() : null;
  } catch {
    return null;
  } finally {
    rmSync(tmpIndex, { force: true });
  }
}

// 差分を取る（実験の出力は除く）。files は比べて変わった、出力ではないファイル
function buildDiff(root, baseTree, nowTree, codeFiles, hasGenerated) {
  const head = [
    "-c", "core.quotepath=false",
    "diff", "--no-color", "--no-ext-diff", "--no-textconv", "-M",
    baseTree, nowTree, "--",
  ];
  let pathspecs;
  if (codeFiles.length <= MAX_PATH_ARGS) {
    pathspecs = codeFiles.map((f) => `:(literal)${f}`);
  } else if (hasGenerated) {
    // ファイルが多いときは全体の差分から、出力のパターンを除く
    pathspecs = [
      ...GENERATED_EXTENSIONS.map((ext) => `:(exclude,glob,icase)**/*${ext}`),
      ":(exclude,glob,icase)**/*tfevents*",
    ];
  } else {
    pathspecs = [];
  }
  const r = git([...head, ...pathspecs], { cwd: root });
  return cap(r.stdout, MAX_DIFF_CHARS);
}

// 途中で pull や切り替えがあったか
export function detectHeadMoved(root, baseHead) {
  const head = currentHead(root);
  if (!baseHead || !head || head === baseHead) return false;
  // baseHead が HEAD の祖先でなければ、切り替えや巻き戻し
  const anc = git(["merge-base", "--is-ancestor", baseHead, head], { cwd: root });
  if (!anc.ok) return true;
  const range = `${baseHead}..${head}`;
  if (gitOut(["rev-list", "--merges", range], { cwd: root })) return true;
  const me = gitOut(["config", "user.email"], { cwd: root }).toLowerCase();
  const authors = gitOut(["log", "--format=%ae", range], { cwd: root })
    .split("\n")
    .filter(Boolean);
  return authors.some((a) => a.toLowerCase() !== me);
}

// ---- 会話記録から失敗したコマンドを取り出す ----

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text);
    if (texts.length > 0) return texts.join("\n");
  }
  try {
    return JSON.stringify(content) ?? "";
  } catch {
    return "";
  }
}

function isErrorFlag(value) {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

// ユーザーが許可しなかっただけのものは、エラーではない
function isPermissionDenial(text) {
  return /doesn't want to proceed|user rejected/i.test(text);
}

// transcript（JSONL）から、promptAt 以降に失敗したツール呼び出しを最大10件取る。
// 形式は公開された仕様ではないので、読めなければ []（例外は投げない）
export function parseObservedErrors(transcriptText, promptAt) {
  try {
    const since = promptAt ? Date.parse(promptAt) : 0;
    const toolUses = new Map();
    const results = [];
    for (const line of String(transcriptText).split("\n")) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const blocks = entry?.message?.content;
      if (!Array.isArray(blocks)) continue;
      const time = Date.parse(entry.timestamp);
      if (entry.type === "assistant") {
        for (const b of blocks) {
          if (b?.type === "tool_use" && typeof b.id === "string") toolUses.set(b.id, b);
        }
      } else if (entry.type === "user") {
        if (!(time >= since)) continue; // timestamp が無い・古いものは対象外
        for (const b of blocks) {
          if (b?.type === "tool_result" && isErrorFlag(b.is_error)) results.push(b);
        }
      }
    }
    const errors = [];
    for (const r of results) {
      const output = contentToText(r.content);
      if (isPermissionDenial(output)) continue;
      const use = toolUses.get(r.tool_use_id);
      const tool = use?.name ?? "unknown";
      const rawInput = use?.input ?? {};
      const input =
        tool === "Bash" && typeof rawInput.command === "string"
          ? rawInput.command
          : (() => {
              try {
                return JSON.stringify(rawInput);
              } catch {
                return "";
              }
            })();
      errors.push({
        tool,
        input: cap(input, MAX_ERROR_INPUT_CHARS),
        output: capHeadTail(output, MAX_ERROR_OUTPUT_CHARS),
      });
    }
    return errors.slice(-MAX_OBSERVED_ERRORS);
  } catch {
    return [];
  }
}

function readObservedErrors(transcriptPath, promptAt) {
  try {
    if (!transcriptPath) return [];
    return parseObservedErrors(readFileSync(transcriptPath, "utf8"), promptAt);
  } catch {
    return [];
  }
}

// ---- 状態（.git/research-check/） ----

function sessionFile(stateDir, sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  return path.join(stateDir, "sessions", `${safe}.json`);
}

function loadSession(stateDir, sessionId) {
  const s = readJson(sessionFile(stateDir, sessionId));
  if (!s || typeof s !== "object") return null;
  return {
    prompts: Array.isArray(s.prompts) ? s.prompts.filter((p) => typeof p === "string") : [],
    lastPrompt: typeof s.lastPrompt === "string" ? s.lastPrompt : "",
    promptAt: typeof s.promptAt === "string" ? s.promptAt : "",
    baseTree: typeof s.baseTree === "string" ? s.baseTree : "",
    baseHead: typeof s.baseHead === "string" ? s.baseHead : "",
    open: s.open === true,
  };
}

function saveSession(stateDir, sessionId, state) {
  writeFileAtomic(sessionFile(stateDir, sessionId), JSON.stringify(state, null, 2));
}

// ---- 受け取り箱への送信と、送れなかった分（outbox） ----

function outboxDir(stateDir) {
  return path.join(stateDir, "outbox");
}

function listOutbox(stateDir) {
  try {
    return readdirSync(outboxDir(stateDir))
      .filter((n) => n.endsWith(".json"))
      .sort()
      .map((n) => path.join(outboxDir(stateDir), n));
  } catch {
    return [];
  }
}

// 送れなかった内容を貯める。20件までで、古いものから消す
let outboxSeq = 0;
export function enqueueOutbox(stateDir, payload) {
  // 時刻 + 連番で、貯めた順に並ぶ名前にする
  const seq = String(outboxSeq++ % 1_000_000).padStart(6, "0");
  const name = `${String(Date.now()).padStart(15, "0")}-${seq}-${Math.random().toString(36).slice(2, 6)}.json`;
  writeFileAtomic(path.join(outboxDir(stateDir), name), JSON.stringify(payload));
  const files = listOutbox(stateDir);
  for (const old of files.slice(0, Math.max(0, files.length - MAX_OUTBOX))) {
    rmSync(old, { force: true });
  }
}

async function postPayload(ctx, payload) {
  if (!ctx.token) return { ok: false, status: 0 };
  try {
    const res = await fetch(`${ctx.url}/api/hook/changes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// 貯めた分を古い順に送り直す。最初の失敗で止める
async function retryOutbox(ctx) {
  if (ctx.outboxChecked) return;
  ctx.outboxChecked = true;
  if (!ctx.token) return;
  for (const file of listOutbox(ctx.stateDir)) {
    const payload = readJson(file);
    if (!payload) {
      rmSync(file, { force: true }); // 壊れたものは捨てる
      continue;
    }
    const r = await postPayload(ctx, payload);
    if (r.ok || [400, 413, 422].includes(r.status)) {
      // 成功、または何度送っても通らない（本文が不正・大きすぎる）ものは消す
      rmSync(file, { force: true });
      continue;
    }
    ctx.serverDown = true; // 続けて送る分も、待たずに貯める
    return;
  }
}

// ---- Stop（AI が返事を終えたとき。UserPromptSubmit からの「閉じ忘れ」の送信にも使う） ----

async function handleStop(ctx, input) {
  await retryOutbox(ctx);
  const sessionId = input.session_id || "unknown";
  const state = loadSession(ctx.stateDir, sessionId);

  const nowTree = takeSnapshot(ctx.root, ctx.stateDir);
  if (!nowTree) return;
  const head = currentHead(ctx.root);

  // フックを会話の途中で入れたとき、または基準が取れていないとき：基準だけ記録する
  if (!state || !state.baseTree) {
    saveSession(ctx.stateDir, sessionId, {
      prompts: state?.prompts ?? [],
      lastPrompt: state?.lastPrompt ?? "",
      promptAt: state?.promptAt ?? "",
      baseTree: nowTree,
      baseHead: head,
      open: false,
    });
    return;
  }

  const closeWith = () => {
    state.baseTree = nowTree;
    state.baseHead = head;
    state.open = false;
    saveSession(ctx.stateDir, sessionId, state);
  };

  const names = git(
    ["-c", "core.quotepath=false", "diff", "--name-only", "-z", "--no-renames", state.baseTree, nowTree],
    { cwd: ctx.root },
  );
  if (!names.ok) return; // 基準の tree が消えているなど。次回に任せる
  const changed = names.stdout.split("\0").filter(Boolean);
  const generatedFiles = changed.filter(isGeneratedFile);
  const codeFiles = changed.filter((f) => !isGeneratedFile(f));

  // 差分が空（質問に答えただけ、出力だけが変わった）なら送らない
  if (codeFiles.length === 0) {
    closeWith();
    return;
  }

  const diff = buildDiff(ctx.root, state.baseTree, nowTree, codeFiles, generatedFiles.length > 0);
  if (!diff.trim()) {
    closeWith();
    return;
  }

  const idx = state.prompts.lastIndexOf(state.lastPrompt);
  const earlier = (idx >= 0 ? state.prompts.slice(0, idx) : state.prompts).slice(-MAX_EARLIER_PROMPTS);
  const errors = readObservedErrors(input.transcript_path, state.promptAt);

  const payload = {
    repo: parseRepo(gitOut(["remote", "get-url", "origin"], { cwd: ctx.root })),
    sessionId,
    prompt: maskSecrets(state.lastPrompt),
    earlierPrompts: earlier.map(maskSecrets),
    diff: maskSecrets(diff),
    generatedFiles,
    observedErrors: errors.map((e) => ({
      tool: e.tool,
      input: maskSecrets(e.input),
      output: maskSecrets(e.output),
    })),
    headMoved: detectHeadMoved(ctx.root, state.baseHead),
    createdAt: new Date().toISOString(),
  };

  // 前の送信が失敗していたなら、待たずに貯める（順番も守れる）
  const sent = ctx.serverDown ? { ok: false } : await postPayload(ctx, payload);
  if (!sent.ok) enqueueOutbox(ctx.stateDir, payload);

  closeWith();
}

// ---- UserPromptSubmit（学生が依頼したとき） ----

async function handlePrompt(ctx, input) {
  await retryOutbox(ctx);
  const sessionId = input.session_id || "unknown";
  let state = loadSession(ctx.stateDir, sessionId);

  // 前の依頼が閉じていない（Esc で中断など）なら、先にその分を送る
  if (state?.open) {
    await handleStop(ctx, input);
    state = loadSession(ctx.stateDir, sessionId);
  }

  state ??= { prompts: [], lastPrompt: "", promptAt: "", baseTree: "", baseHead: "", open: false };
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  // スラッシュコマンドは作業の目的にならないので、履歴に入れない
  if (!prompt.trim().startsWith("/")) {
    state.prompts = [...state.prompts, prompt].slice(-MAX_PROMPTS_KEPT);
    state.lastPrompt = prompt;
  }
  state.promptAt = new Date().toISOString();
  state.baseHead = currentHead(ctx.root);
  state.baseTree = takeSnapshot(ctx.root, ctx.stateDir) ?? "";
  state.open = state.baseTree !== "";
  saveSession(ctx.stateDir, sessionId, state);
}

// ---- 入口 ----

export function createContext(input, env, scriptDir) {
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const root = gitOut(["rev-parse", "--show-toplevel"], { cwd });
  const gitDir = gitOut(["rev-parse", "--absolute-git-dir"], { cwd });
  if (!root || !gitDir) return null; // git のリポジトリの外では何もしない
  const { token, url } = loadConfig(env, scriptDir);
  return {
    root,
    stateDir: path.join(gitDir, "research-check"),
    token,
    url,
    outboxChecked: false,
    serverDown: false,
  };
}

export async function run(input, env = process.env, scriptDir = path.dirname(fileURLToPath(import.meta.url))) {
  const ctx = createContext(input, env, scriptDir);
  if (!ctx) return;
  if (input.hook_event_name === "UserPromptSubmit") await handlePrompt(ctx, input);
  else if (input.hook_event_name === "Stop") await handleStop(ctx, input);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  try {
    const text = await readStdin();
    const input = text.trim() ? JSON.parse(text) : {};
    await run(input);
  } catch (e) {
    warn(`失敗しましたが、作業は続けられます（${e instanceof Error ? e.message : "不明なエラー"}）`);
  }
  process.exit(0); // 何があっても Claude Code を止めない
}

function isMain() {
  try {
    return (
      Boolean(process.argv[1]) &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isMain()) await main();
