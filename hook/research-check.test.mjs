// hook/research-check.mjs のテスト。`node --test hook/` で動く。
// 結合テストは、一時的な git リポジトリと、POST を受ける小さな HTTP サーバーを立てて、
// スクリプトを子プロセスとして動かす。値はすべてテスト用で、本物の合言葉は使わない。

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  maskSecrets, parseRepo, isGeneratedFile, parseObservedErrors, parseTranscript, pickErrorLines, pickNumericAnomalyLines, analyzeCommand, parseDotenv,
  loadConfig, enqueueOutbox, MASK, MAX_OUTBOX,
} from "./research-check.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "research-check.mjs");
const TOKEN = "test-token-for-unit-tests";

// ---- 単体テスト ----

test("maskSecrets: 代表的なキーやトークンを伏せ字にする", () => {
  const src = [
    // 秘密情報の検出ツールに引っかからないよう、テスト用の文字列は分けて書く
    "a " + "sk-ant-" + "api03-abcdefghijklmnop b",
    "c " + "sk-" + "abcdefghijklmnopqrstuvwx d",
    "e " + "gh" + "p_abcdefghijklmnopqrstuvwxyz0123 f",
    "g " + "github_" + "pat_abcdefghijklmnopqrstu h",
    "i " + "AK" + "IAABCDEFGHIJKLMNOP j",
    "k " + "xo" + "xb-1234567890-abcdef l",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEabc\n-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const out = maskSecrets(src);
  for (const leaked of [
    "abcdefghijklmnop", "ghp_abc", "github_pat_abc", "AKIAABCDEFGHIJKLMNOP", "xoxb-1234", "MIIEabc",
  ]) {
    assert.ok(!out.includes(leaked), `${leaked} が残っている`);
  }
  assert.equal(out.split(MASK).length - 1, 7);
});

test("maskSecrets: キー名は残して値だけ伏せる。短い値や普通の文は変えない", () => {
  assert.equal(maskSecrets('API_KEY = "abcd1234efgh"'), `API_KEY = ${MASK}`);
  assert.equal(maskSecrets("password: hunter2hunter2"), `password: ${MASK}`);
  assert.equal(maskSecrets("token=short"), "token=short");
  assert.equal(maskSecrets("learning_rate = 0.001"), "learning_rate = 0.001");
});

test("parseRepo: github.com の https / ssh / scp 形式から owner/name を求める", () => {
  assert.equal(parseRepo("https://github.com/jphacks/ng_2614.git"), "jphacks/ng_2614");
  assert.equal(parseRepo("https://github.com/jphacks/ng_2614"), "jphacks/ng_2614");
  assert.equal(parseRepo("https://user:pw@github.com/a/b.git/"), "a/b");
  assert.equal(parseRepo("git@github.com:owner/my.repo.git"), "owner/my.repo");
  assert.equal(parseRepo("ssh://git@github.com/owner/name.git"), "owner/name");
  assert.equal(parseRepo("https://gitlab.com/owner/name.git"), "");
  assert.equal(parseRepo(""), "");
});

test("isGeneratedFile: 実験の出力を拡張子で見分ける（大文字小文字は区別しない）", () => {
  for (const f of [
    "results/out.csv", "a/B.PNG", "model.PT", "x.safetensors", "runs/events.out.tfevents.1234",
    "x.npz", "d.parquet", "m.onnx", "train.LOG",
  ]) {
    assert.ok(isGeneratedFile(f), f);
  }
  for (const f of ["train.py", "README.md", "config.yaml", "csv_utils.py", "notes.txt"]) {
    assert.ok(!isGeneratedFile(f), f);
  }
});

function transcriptLine(type, timestamp, content) {
  return JSON.stringify({ type, timestamp, message: { content } });
}

test("parseTranscript: 本当に失敗したコマンドだけを失敗として取り、Claude Code 自身のメッセージは捨てる", () => {
  const lines = [
    // promptAt より前のエラーは対象外
    transcriptLine("assistant", "2026-10-24T09:00:00.000Z", [
      { type: "tool_use", id: "t0", name: "Bash", input: { command: "old" } },
    ]),
    transcriptLine("user", "2026-10-24T09:00:01.000Z", [
      { type: "tool_result", tool_use_id: "t0", is_error: true, content: "Exit code 1\nold error" },
    ]),
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "python train.py" } },
      { type: "tool_use", id: "t2", name: "Edit", input: { file_path: "a.py", old_string: "x" } },
      { type: "tool_use", id: "t3", name: "Bash", input: { command: "ls" } },
      { type: "tool_use", id: "t4", name: "Bash", input: { command: "rm -rf x" } },
      { type: "tool_use", id: "t5", name: "Bash", input: { command: "sed -i s/a/b/ f" } },
    ]),
    "これは壊れた行",
    transcriptLine("user", "2026-10-24T10:00:02.000Z", [
      { type: "tool_result", tool_use_id: "t1", is_error: true, content: "Exit code 1\nTraceback: boom" },
      { type: "tool_result", tool_use_id: "t2", is_error: "True", content: [{ type: "text", text: "no match" }] },
      { type: "tool_result", tool_use_id: "t3", is_error: false, content: "fine" },
      {
        type: "tool_result", tool_use_id: "t4", is_error: true,
        content: "The user doesn't want to proceed with this tool use.",
      },
      {
        type: "tool_result", tool_use_id: "t5", is_error: true,
        content: "This Bash command contains multiple operations. The following part requires approval: sed",
      },
    ]),
  ];
  const { errors } = parseTranscript(lines.join("\n"), "2026-10-24T10:00:00.000Z");
  assert.deepEqual(errors, [
    { kind: "failed", tool: "Bash", input: "python train.py", output: "Exit code 1\nTraceback: boom" },
  ]);
});

test("parseTranscript: 成功したコマンドの出力に出たエラーの行を、まわりと一緒に取る", () => {
  const out = [
    "loading data", "rows: 600", "fold 1", "fold 2",
    "/x/sklearn/model_selection/_validation.py:528: FitFailedWarning:",
    "All the 5 fits failed.", "detail line", "ValueError: Input X contains NaN.",
    "a", "b", "c", "d", "e", "f", "summary: done",
  ].join("\n");
  const lines = [
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
      { type: "tool_use", id: "t1", name: "Bash", input: { command: ".venv/bin/python compare_raw.py" } },
      { type: "tool_use", id: "t2", name: "Bash", input: { command: "cat README.md" } },
      { type: "tool_use", id: "t3", name: "Read", input: { file_path: "x.py" } },
    ]),
    transcriptLine("user", "2026-10-24T10:00:02.000Z", [
      { type: "tool_result", tool_use_id: "t1", is_error: false, content: out },
      { type: "tool_result", tool_use_id: "t2", is_error: false, content: "no problems here, 0 errors" },
      { type: "tool_result", tool_use_id: "t3", is_error: false, content: "raise ValueError('x')" },
    ]),
  ];
  const { errors } = parseTranscript(lines.join("\n"), "2026-10-24T10:00:00.000Z");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, "in_output");
  assert.equal(errors[0].input, ".venv/bin/python compare_raw.py");
  assert.ok(errors[0].output.includes("All the 5 fits failed."));
  assert.ok(errors[0].output.includes("ValueError: Input X contains NaN."));
  assert.ok(!errors[0].output.includes("loading data")); // まわり以外は取らない
  assert.ok(!errors[0].output.includes("summary: done"));
});

test("pickErrorLines: エラーらしい行が無ければ空", () => {
  assert.equal(pickErrorLines("all good\nmacro F1 0.73"), "");
  assert.ok(pickErrorLines("x\nConvergenceWarning: lbfgs failed to converge").includes("ConvergenceWarning"));
});

// 1つの Bash 呼び出しの結果を作る。detail を渡すと、成功したときの toolUseResult（stdout / stderr）も付ける
function bashRun(command, { content = "", isError = false, detail } = {}) {
  const assistant = transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
    { type: "tool_use", id: "b1", name: "Bash", input: { command } },
  ]);
  const user = JSON.parse(
    transcriptLine("user", "2026-10-24T10:00:02.000Z", [
      { type: "tool_result", tool_use_id: "b1", is_error: isError, content },
    ]),
  );
  if (detail) user.toolUseResult = detail;
  return [assistant, JSON.stringify(user)].join("\n");
}

function observed(run) {
  return parseTranscript(run, "2026-10-24T10:00:00.000Z").errors;
}

test("analyzeCommand: 区切り・ヒアドキュメント・ラッパー・パスを読んで、探索のコマンドかを判定する", () => {
  const explore = (c) => analyzeCommand(c).exploration;
  assert.ok(explore("git ls-files && cat README.md && for f in $(git ls-files '*.py'); do echo \"=== $f\"; cat $f; done"));
  assert.ok(explore("cd src && ls -la | head -5"));
  assert.ok(explore("FOO=1 command -v uv"));
  assert.ok(explore("cat <<'EOF'\npython train.py; rm -rf x\nEOF"));
  assert.ok(explore("ls # python train.py"));
  assert.ok(!explore("cd src && python train.py"));
  assert.ok(!explore(".venv/bin/python - <<'EOF'\nprint(1)\nEOF"));
  assert.ok(!explore("time timeout 600 nohup uv run python a.py 2>&1 | tail -20"));
  assert.ok(!explore("python -c \"print(1); print(2)\" ; echo done"));
  assert.ok(!explore(""));
  assert.equal(analyzeCommand("python train.py | grep loss").lastName, "grep");
  assert.equal(analyzeCommand("sudo -u bob env X=1 /usr/bin/python3 a.py").lastName, "python3");
  assert.equal(analyzeCommand("python a.py 2>&1 | tail").mergesStderr, true);
  assert.equal(analyzeCommand("python a.py > out.txt").mergesStderr, false);
});

test("parseTranscript: 探索のコマンドが表示したコードは、成功でも失敗でもエラーにしない", () => {
  const code = 'def get(name):\n    raise ValueError(f"unknown schedule: {name}")\n';
  const listing = "git ls-files && cat README.md && for f in $(git ls-files '*.py'); do echo \"=== $f\"; cat $f; done";
  assert.deepEqual(
    observed(bashRun(listing, { content: code, detail: { stdout: code, stderr: "", interrupted: false } })),
    [],
  );
  assert.deepEqual(observed(bashRun("cat a.py", { content: code })), []); // toolUseResult が無い古い形式でも
  assert.deepEqual(observed(bashRun("cat missing.py", { isError: true, content: "Exit code 1\ncat: missing.py: No such file" })), []);
  // 実行するコマンドが、コードを stdout に表示しただけ（stderr は空）
  const heredoc = ".venv/bin/python - <<'EOF'\nprint(open('a.py').read())\nEOF";
  assert.deepEqual(
    observed(bashRun(heredoc, { content: code, detail: { stdout: code, stderr: "", interrupted: false } })),
    [],
  );
});

test("parseTranscript: 成功した実行コマンドは、stderr のエラーらしい行だけを取る", () => {
  const stderr = "x.py:3: RuntimeWarning: something odd\nTraceback (most recent call last):\n  File \"a.py\"\nKeyError: 'a'";
  const errors = observed(
    bashRun("python train.py", { content: "ok\n" + stderr, detail: { stdout: "ok", stderr, interrupted: false } }),
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, "in_output");
  assert.ok(errors[0].output.includes("Traceback"));
  assert.ok(errors[0].output.includes("RuntimeWarning"));
  // 2>&1 で stderr が stdout に混ざっているときは、stdout からも探す
  const merged = "epoch 1\nValueError: bad value";
  const e2 = observed(
    bashRun("python train.py 2>&1 | tail -5", { content: merged, detail: { stdout: merged, stderr: "", interrupted: false } }),
  );
  assert.equal(e2.length, 1);
  assert.ok(e2[0].output.includes("ValueError: bad value"));
});

test("parseTranscript: grep の0件など、終了コード 1 が普通のコマンドの失敗はエラーにしない", () => {
  assert.deepEqual(observed(bashRun("grep foo file.txt", { isError: true, content: "Exit code 1" })), []);
  assert.deepEqual(
    observed(bashRun(".venv/bin/python train.py | grep loss", { isError: true, content: "Exit code 1" })),
    [],
  );
  // grep だけのコマンドは探索なので、終了コード 2 でも無視する
  assert.equal(observed(bashRun("grep foo nofile", { isError: true, content: "Exit code 2\nno such file" })).length, 0);
  // 終了コード 2 以上や、最後が grep ではない実行コマンドの失敗は残す
  assert.equal(
    observed(bashRun("python train.py | grep loss", { isError: true, content: "Exit code 2\nTraceback boom" })).length,
    1,
  );
  assert.equal(
    observed(bashRun("python train.py | tail -3", { isError: true, content: "Exit code 1\nTraceback boom" })).length,
    1,
  );
});

test("parseTranscript: 実行コマンドの失敗は、これまでどおり失敗として取る", () => {
  const content = "Exit code 1\nTraceback (most recent call last):\nValueError: boom";
  assert.deepEqual(observed(bashRun("python train.py", { isError: true, content })), [
    { kind: "failed", tool: "Bash", input: "python train.py", output: content },
  ]);
});

test("parseTranscript: nan・inf・overflow などの数値の異常を、成功した実行コマンドの出力から取る", () => {
  const stdout = "epoch 1 loss: 0.9\nepoch 2 loss: nan\nepoch 3 loss: nan";
  const errors = observed(
    bashRun("python train.py", { content: stdout, detail: { stdout, stderr: "", interrupted: false } }),
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, "in_output");
  assert.ok(errors[0].output.includes("epoch 2 loss: nan"));

  // stderr のエラーと stdout の数値の異常は、1件にまとめる
  const merged = observed(
    bashRun("python train.py", {
      content: "",
      detail: { stdout: "w = -inf", stderr: "RuntimeWarning: overflow encountered in exp", interrupted: false },
    }),
  );
  assert.equal(merged.length, 1);
  assert.ok(merged[0].output.includes("w = -inf"));
  assert.ok(merged[0].output.includes("overflow encountered"));

  // 失敗したが grep の0件と同じ扱いのとき（終了コード 1）も、実行コマンドなら数値の異常は拾う
  const piped = observed(
    bashRun("python train.py | grep loss", { isError: true, content: "Exit code 1\nloss=nan" }),
  );
  assert.equal(piped.length, 1);
  assert.equal(piped[0].kind, "in_output");

  // diverg は見ない（KL divergence は普通の指標名）。探索のコマンドの出力も見ない
  assert.deepEqual(
    observed(bashRun("python eval.py", { content: "kl_divergence: 0.2", detail: { stdout: "kl_divergence: 0.2", stderr: "", interrupted: false } })),
    [],
  );
  assert.deepEqual(observed(bashRun("echo loss: nan", { content: "loss: nan", detail: { stdout: "loss: nan", stderr: "", interrupted: false } })), []);
});

test("pickNumericAnomalyLines: コードに書かれた nan・inf の名前は、数値の異常と見なさない", () => {
  for (const line of [
    "x = np.nan", "if math.isnan(x):", "y = float('inf')", 'z = float("-inf")', "torch.nan_to_num(x)",
    "info: done", "infinity", "import nan_utils", "r = math.inf", "see nan.csv",
  ]) {
    assert.equal(pickNumericAnomalyLines(line), "", line);
  }
  for (const line of ["loss: nan", "loss=NaN", "grad -inf", "[inf, 2.0]", "overflow encountered in exp", "RuntimeWarning: invalid value encountered in divide", "divide by zero encountered in log"]) {
    assert.notEqual(pickNumericAnomalyLines(line), "", line);
  }
});

test("parseTranscript: toolUseResult が無いとき、または tool_result が複数のときは、出力の全体から探す", () => {
  const out = "loading\nTraceback (most recent call last):\nKeyError: 'a'";
  const errors = observed(bashRun("python a.py", { content: out }));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].output.includes("KeyError"));

  // tool_result が2つ並ぶ entry の toolUseResult は、どちらのものか分からないので信用しない
  const lines = [
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
      { type: "tool_use", id: "p1", name: "Bash", input: { command: "python a.py" } },
      { type: "tool_use", id: "p2", name: "Bash", input: { command: "python b.py" } },
    ]),
  ];
  const user = JSON.parse(
    transcriptLine("user", "2026-10-24T10:00:02.000Z", [
      { type: "tool_result", tool_use_id: "p1", is_error: false, content: out },
      { type: "tool_result", tool_use_id: "p2", is_error: false, content: "fine" },
    ]),
  );
  user.toolUseResult = { stdout: "", stderr: "", interrupted: false };
  lines.push(JSON.stringify(user));
  const multi = parseTranscript(lines.join("\n"), "2026-10-24T10:00:00.000Z").errors;
  assert.equal(multi.length, 1);
  assert.equal(multi[0].input, "python a.py");
});

test("parseTranscript: AI の最終報告（最後のツールの動きより後の文章）を取る", () => {
  const lines = [
    transcriptLine("assistant", "2026-10-24T09:59:00.000Z", [{ type: "text", text: "前の依頼の報告" }]),
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
      { type: "text", text: "まずデータを見ます" },
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "python a.py" } },
    ]),
    transcriptLine("user", "2026-10-24T10:00:02.000Z", [
      { type: "tool_result", tool_use_id: "t1", is_error: false, content: "ok" },
    ]),
    transcriptLine("assistant", "2026-10-24T10:00:03.000Z", [{ type: "text", text: "train.py を作りました。" }]),
    transcriptLine("assistant", "2026-10-24T10:00:04.000Z", [{ type: "text", text: "hba1c に欠損があったので中央値で補完しました。" }]),
  ];
  const { aiReport } = parseTranscript(lines.join("\n"), "2026-10-24T10:00:00.000Z");
  assert.equal(aiReport, "train.py を作りました。\nhba1c に欠損があったので中央値で補完しました。");
});

test("parseTranscript: 最後がツールで終わっていれば直前の文章を報告にする。長さの上限、件数の上限、読めないときは空", () => {
  const ending = [
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", [
      { type: "text", text: "途中の報告" + "あ".repeat(4000) },
      { type: "tool_use", id: "t1", name: "Bash", input: { command: "x" } },
    ]),
  ].join("\n");
  const r = parseTranscript(ending, "2026-10-24T10:00:00.000Z");
  assert.ok(r.aiReport.startsWith("途中の報告"));
  assert.ok(r.aiReport.length <= 3000);

  const uses = [];
  const results = [];
  for (let i = 0; i < 15; i++) {
    uses.push({ type: "tool_use", id: `u${i}`, name: "Bash", input: { command: "c".repeat(900) } });
    results.push({ type: "tool_result", tool_use_id: `u${i}`, is_error: true, content: `Exit code 1\nE${i}:` + "x".repeat(5000) });
  }
  const text = [
    transcriptLine("assistant", "2026-10-24T10:00:01.000Z", uses),
    transcriptLine("user", "2026-10-24T10:00:02.000Z", results),
  ].join("\n");
  const { errors } = parseTranscript(text, "2026-10-24T10:00:00.000Z");
  assert.equal(errors.length, 10);
  assert.ok(errors[0].output.includes("E5:")); // 最新の10件
  assert.ok(errors[9].output.includes("E14:"));
  for (const e of errors) {
    assert.ok(e.input.length <= 500);
    assert.ok(e.output.length <= 2000);
  }
  assert.deepEqual(parseTranscript("{{{{", ""), { errors: [], aiReport: "" });
  assert.deepEqual(parseTranscript(null, ""), { errors: [], aiReport: "" });
  assert.deepEqual(parseObservedErrors(null, ""), []);
});

test("parseDotenv と loadConfig: 環境変数 → web/.env.local → アプリの設定ファイルの順に読む", () => {
  const parsed = parseDotenv(
    ['# コメント', 'A=1', 'export B="two words"', "C='3'", "D=4 # 後ろのコメント", "", "bad line"].join("\n"),
  );
  assert.deepEqual(parsed, { A: "1", B: "two words", C: "3", D: "4" });

  const dir = mkdtempSync(path.join(tmpdir(), "rc-config-"));
  try {
    mkdirSync(path.join(dir, "hook"));
    mkdirSync(path.join(dir, "web"));
    writeFileSync(
      path.join(dir, "web", ".env.local"),
      'RESEARCH_CHECK_TOKEN="from-file"\nRESEARCH_CHECK_URL=http://localhost:4000/\n',
    );
    const scriptDir = path.join(dir, "hook");
    const appConfig = path.join(dir, "config.json");
    const none = { TAZUNA_CONFIG: path.join(dir, "missing.json") };
    assert.deepEqual(loadConfig(none, scriptDir), { token: "from-file", url: "http://localhost:4000" });
    assert.equal(loadConfig({ ...none, RESEARCH_CHECK_TOKEN: "from-env" }, scriptDir).token, "from-env");
    const nowhere = path.join(dir, "nowhere", "hook");
    assert.deepEqual(loadConfig(none, nowhere), { token: "", url: "http://localhost:3000" });

    writeFileSync(appConfig, JSON.stringify({ researchCheckToken: "from-app" }));
    assert.equal(loadConfig({ TAZUNA_CONFIG: appConfig }, nowhere).token, "from-app");
    assert.equal(loadConfig({ TAZUNA_CONFIG: appConfig }, scriptDir).token, "from-file");
    writeFileSync(appConfig, "{ broken");
    assert.equal(loadConfig({ TAZUNA_CONFIG: appConfig }, nowhere).token, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("enqueueOutbox: 20件までで、古いものから消す", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rc-outbox-"));
  try {
    for (let i = 0; i < MAX_OUTBOX + 3; i++) enqueueOutbox(dir, { n: i });
    const files = readdirSync(path.join(dir, "outbox")).sort();
    assert.equal(files.length, MAX_OUTBOX);
    const ns = files.map((f) => JSON.parse(readFileSync(path.join(dir, "outbox", f), "utf8")).n);
    assert.equal(ns[0], 3);
    assert.equal(ns.at(-1), MAX_OUTBOX + 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- 結合テストの道具 ----

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  TAZUNA_CONFIG: "/dev/null/tazuna-test/config.json", // 本物の ~/.tazuna を読まない
};

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" });
}

function makeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "rc-repo-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "me@example.com");
  git(dir, "config", "user.name", "Me");
  git(dir, "remote", "add", "origin", "git@github.com:owner/study.git");
  writeFileSync(path.join(dir, "train.py"), "lr = 0.1\n");
  writeFileSync(path.join(dir, "notes.py"), "# memo\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

function startServer() {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"),
      });
      res.statusCode = handle.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "x" }));
    });
  });
  const handle = { server, received, status: 202, port: 0 };
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      handle.port = server.address().port;
      handle.url = `http://127.0.0.1:${handle.port}`;
      handle.close = () => new Promise((r) => server.close(r));
      resolve(handle);
    });
  });
}

// 使われていないポート（接続拒否になる）
async function closedUrl() {
  const s = await startServer();
  await s.close();
  return s.url;
}

function runHook(cwd, url, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd,
      env: { ...GIT_ENV, RESEARCH_CHECK_TOKEN: TOKEN, RESEARCH_CHECK_URL: url },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

function makeSession(repo, url) {
  const base = { session_id: "sess-1", cwd: repo, transcript_path: path.join(repo, "..", "none.jsonl") };
  const calls = [];
  const api = {
    async prompt(prompt) {
      const r = await runHook(repo, url, { ...base, hook_event_name: "UserPromptSubmit", prompt });
      calls.push(r);
      return r;
    },
    async stop(extra = {}) {
      const r = await runHook(repo, url, { ...base, ...extra, hook_event_name: "Stop" });
      calls.push(r);
      return r;
    },
    calls,
  };
  return api;
}

async function withEnv(fn) {
  const repo = makeRepo();
  const server = await startServer();
  try {
    await fn({ repo, server });
  } finally {
    await server.close();
    rmSync(repo, { recursive: true, force: true });
  }
}

const stateDirOf = (repo) => path.join(repo, ".git", "research-check");

// ---- 結合テスト ----

test("流れ全体：依頼→変更→Stop で、AI が変えた差分だけが正しい形で送られる", () =>
  withEnv(async ({ repo, server }) => {
    // 依頼の前に、学生が自分で変えていた部分（差分に入らないはず）
    writeFileSync(path.join(repo, "notes.py"), "# memo\n# student wrote this\n");
    const s = makeSession(repo, server.url);
    const r1 = await s.prompt("学習率を 0.01 に変えて");
    assert.equal(r1.code, 0);
    assert.equal(r1.stdout, "");

    // AI の変更
    writeFileSync(path.join(repo, "train.py"), "lr = 0.01\n");
    writeFileSync(path.join(repo, "new_model.py"), "def f():\n    return 1\n");
    mkdirSync(path.join(repo, "results"));
    writeFileSync(path.join(repo, "results", "out.csv"), "a,b\nSECRET_ROW,2\n");
    writeFileSync(path.join(repo, "model.PT"), "weights");
    writeFileSync(path.join(repo, "big.dat"), Buffer.alloc(1024 * 1024 + 1, "a"));
    writeFileSync(path.join(repo, "config.py"), 'API_KEY = "abcd1234efgh5678"\n');

    // 会話記録
    const transcript = path.join(repo, ".git", "transcript.jsonl");
    writeFileSync(
      transcript,
      [
        transcriptLine("assistant", new Date(Date.now() + 1000).toISOString(), [
          { type: "tool_use", id: "t1", name: "Bash", input: { command: "python train.py" } },
        ]),
        transcriptLine("user", new Date(Date.now() + 2000).toISOString(), [
          { type: "tool_result", tool_use_id: "t1", is_error: true, content: "Exit code 1\nTraceback: boom" },
        ]),
        transcriptLine("assistant", new Date(Date.now() + 3000).toISOString(), [
          { type: "text", text: "train.py を直しました。token = abcd1234efgh5678 を使っています。" },
        ]),
      ].join("\n"),
    );

    const r2 = await s.stop({ transcript_path: transcript });
    assert.equal(r2.code, 0);
    assert.equal(r2.stdout, "");

    assert.equal(server.received.length, 1);
    const req = server.received[0];
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/api/hook/changes");
    assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
    assert.equal(req.headers["content-type"], "application/json");

    const p = req.body;
    assert.deepEqual(
      Object.keys(p).sort(),
      ["aiReport", "createdAt", "diff", "earlierPrompts", "generatedFiles", "headMoved", "observedErrors", "prompt", "repo", "sessionId"],
    );
    assert.equal(p.repo, "owner/study");
    assert.equal(p.sessionId, "sess-1");
    assert.equal(p.prompt, "学習率を 0.01 に変えて");
    assert.deepEqual(p.earlierPrompts, []);
    assert.equal(p.headMoved, false);
    assert.ok(!Number.isNaN(Date.parse(p.createdAt)));
    assert.deepEqual(p.observedErrors, [
      { kind: "failed", tool: "Bash", input: "python train.py", output: "Exit code 1\nTraceback: boom" },
    ]);
    assert.ok(p.aiReport.startsWith("train.py を直しました。"));
    assert.ok(!p.aiReport.includes("abcd1234efgh5678")); // 最終報告も伏せ字にする
    assert.deepEqual([...p.generatedFiles].sort(), ["model.PT", "results/out.csv"]);

    assert.match(p.diff, /\+lr = 0\.01/);
    assert.match(p.diff, /new_model\.py/);
    assert.ok(!p.diff.includes("student wrote this"), "学生が先に変えた部分は入らない");
    assert.ok(!p.diff.includes("SECRET_ROW"), "出力ファイルの中身は送らない");
    assert.ok(!p.diff.includes("big.dat"), "1MB を超えるファイルは対象外");
    assert.ok(!p.diff.includes("model.PT"));
    assert.ok(!p.diff.includes("abcd1234efgh5678"), "キーは伏せ字");
    assert.match(p.diff, new RegExp(`API_KEY = ${MASK.replace(/[[\]]/g, "\\$&")}`));

    // 本物のインデックスと作業ツリーは変えていない
    assert.equal(git(repo, "diff", "--cached", "--name-only"), "");
    assert.ok(existsSync(path.join(repo, "results", "out.csv")));
    // 閉じた状態になっている
    const state = JSON.parse(readFileSync(path.join(stateDirOf(repo), "sessions", "sess-1.json"), "utf8"));
    assert.equal(state.open, false);
  }));

test("差分が空なら何も送らない。出力ファイルだけの変更でも送らない", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("このコードの意味を教えて");
    await s.stop();
    assert.equal(server.received.length, 0);

    await s.prompt("実験を回して");
    writeFileSync(path.join(repo, "log.txt.log"), "epoch 1\n");
    writeFileSync(path.join(repo, "plot.png"), "png");
    await s.stop();
    assert.equal(server.received.length, 0);
  }));

test("新しい依頼がないまま Stop がもう一度動いても、二重に送らない", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("train.py を直して");
    writeFileSync(path.join(repo, "train.py"), "lr = 0.5\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    await s.stop();
    assert.equal(server.received.length, 1);

    // 裏で作業が続いて変更が増えたときは、増えた分だけ送る
    writeFileSync(path.join(repo, "train.py"), "lr = 0.7\n");
    await s.stop();
    assert.equal(server.received.length, 2);
    assert.match(server.received[1].body.diff, /-lr = 0\.5/);
    assert.match(server.received[1].body.diff, /\+lr = 0\.7/);
  }));

test("閉じていない前の依頼は、次の依頼のときに前の依頼文で送られる", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("最初の依頼");
    writeFileSync(path.join(repo, "train.py"), "lr = 0.2\n");
    // Stop が動かないまま次の依頼（Esc で中断など）
    const r = await s.prompt("次の依頼");
    assert.equal(r.stdout, "");
    assert.equal(server.received.length, 1);
    assert.equal(server.received[0].body.prompt, "最初の依頼");
    assert.deepEqual(server.received[0].body.earlierPrompts, []);
    assert.match(server.received[0].body.diff, /\+lr = 0\.2/);

    writeFileSync(path.join(repo, "notes.py"), "# changed\n");
    await s.stop();
    assert.equal(server.received.length, 2);
    const p = server.received[1].body;
    assert.equal(p.prompt, "次の依頼");
    assert.deepEqual(p.earlierPrompts, ["最初の依頼"]);
    assert.ok(!p.diff.includes("lr = 0.2"), "前の依頼の変更は二重に入らない");
    assert.match(p.diff, /notes\.py/);
  }));

test("スラッシュコマンドは履歴に入れない。履歴は6件まで、送るのは直近5件", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    for (let i = 1; i <= 8; i++) {
      await s.prompt(`依頼${i}`);
      await s.stop();
    }
    await s.prompt("/commit");
    const file = path.join(stateDirOf(repo), "sessions", "sess-1.json");
    let state = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(state.prompts.length, 6);
    assert.equal(state.lastPrompt, "依頼8");
    assert.ok(!state.prompts.includes("/commit"));
    assert.equal(state.open, true);

    writeFileSync(path.join(repo, "train.py"), "lr = 9\n");
    await s.stop();
    const p = server.received.at(-1).body;
    assert.equal(p.prompt, "依頼8");
    assert.deepEqual(p.earlierPrompts, ["依頼3", "依頼4", "依頼5", "依頼6", "依頼7"]);
    state = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(state.open, false);
  }));

test("送れなかった分は outbox に貯まり、次の依頼のときに送り直される", () =>
  withEnv(async ({ repo, server }) => {
    const down = await closedUrl();
    const s1 = makeSession(repo, down);
    await s1.prompt("落ちているときの依頼");
    writeFileSync(path.join(repo, "train.py"), "lr = 0.3\n");
    const r = await s1.stop();
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    const outbox = path.join(stateDirOf(repo), "outbox");
    assert.equal(readdirSync(outbox).length, 1);

    // 503 でも貯まる
    server.status = 503;
    const s2 = makeSession(repo, server.url);
    await s2.prompt("2番目の依頼");
    assert.equal(server.received.length, 1); // 送り直しは試みたが失敗
    writeFileSync(path.join(repo, "notes.py"), "# 2\n");
    await s2.stop();
    // Stop でも送り直しは試みる（失敗）が、新しい分は待たずに貯める
    assert.equal(server.received.length, 2);
    assert.equal(readdirSync(outbox).length, 2);

    // 復旧したら、古い順に送り直される
    server.status = 202;
    server.received.length = 0;
    await s2.prompt("3番目の依頼");
    assert.equal(server.received.length, 2);
    assert.equal(server.received[0].body.prompt, "落ちているときの依頼");
    assert.equal(server.received[1].body.prompt, "2番目の依頼");
    assert.equal(readdirSync(outbox).length, 0);
  }));

test("合言葉が無いときは送らずに outbox に貯める。トークン文字列は出力に出ない", () =>
  withEnv(async ({ repo, server }) => {
    const run = (input) =>
      new Promise((resolve) => {
        const env = { ...GIT_ENV, RESEARCH_CHECK_URL: server.url };
        delete env.RESEARCH_CHECK_TOKEN;
        // web/.env.local の影響を受けないよう、スクリプトを web の無い場所にコピーして動かす
        const dir = mkdtempSync(path.join(tmpdir(), "rc-script-"));
        mkdirSync(path.join(dir, "hook"));
        writeFileSync(path.join(dir, "hook", "research-check.mjs"), readFileSync(SCRIPT));
        const child = spawn(process.execPath, [path.join(dir, "hook", "research-check.mjs")], { cwd: repo, env });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        child.on("close", (code) => {
          rmSync(dir, { recursive: true, force: true });
          resolve({ code, out });
        });
        child.stdin.end(JSON.stringify(input));
      });
    const base = { session_id: "s", cwd: repo };
    await run({ ...base, hook_event_name: "UserPromptSubmit", prompt: "x" });
    writeFileSync(path.join(repo, "train.py"), "lr = 4\n");
    const r = await run({ ...base, hook_event_name: "Stop" });
    assert.equal(r.code, 0);
    assert.equal(r.out, "");
    assert.equal(server.received.length, 0);
    assert.equal(readdirSync(path.join(stateDirOf(repo), "outbox")).length, 1);
  }));

test("途中で別の人のコミットが入ったら headMoved が true になる", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("何かして");
    writeFileSync(path.join(repo, "other.py"), "x = 1\n");
    git(repo, "add", "other.py");
    git(repo, "-c", "user.email=teammate@example.com", "commit", "-q", "-m", "teammate");
    writeFileSync(path.join(repo, "train.py"), "lr = 5\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    assert.equal(server.received[0].body.headMoved, true);
  }));

test("自分のコミットだけなら headMoved は false。コミットした変更も差分に入る", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("直してコミットして");
    writeFileSync(path.join(repo, "train.py"), "lr = 6\n");
    git(repo, "commit", "-q", "-am", "mine");
    await s.stop();
    assert.equal(server.received.length, 1);
    assert.equal(server.received[0].body.headMoved, false);
    assert.match(server.received[0].body.diff, /\+lr = 6/);
  }));

test("会話の途中でフックを入れたとき（状態なしの Stop）は、基準を記録するだけ", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    writeFileSync(path.join(repo, "train.py"), "lr = 7\n");
    await s.stop();
    assert.equal(server.received.length, 0);
    writeFileSync(path.join(repo, "notes.py"), "# after\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    assert.equal(server.received[0].body.prompt, "");
    assert.ok(!server.received[0].body.diff.includes("lr = 7"));
  }));

test("コミットがまだ無い新しいリポジトリでも動く", async () => {
  const repo = mkdtempSync(path.join(tmpdir(), "rc-fresh-"));
  const server = await startServer();
  try {
    git(repo, "init", "-q", "-b", "main");
    const s = makeSession(repo, server.url);
    await s.prompt("最初のファイルを作って");
    writeFileSync(path.join(repo, "main.py"), "print('hi')\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    assert.equal(server.received[0].body.repo, "");
    assert.match(server.received[0].body.diff, /\+print\('hi'\)/);
  } finally {
    await server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test("ファイル名に特殊文字があっても扱える", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("ファイルを足して");
    writeFileSync(path.join(repo, "a[1]*.py"), "x = 1\n");
    writeFileSync(path.join(repo, "日本語.py"), "y = 2\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    assert.match(server.received[0].body.diff, /\+x = 1/);
    assert.match(server.received[0].body.diff, /日本語\.py/);
  }));

test("git のリポジトリの外では、何も出さず何もせず終わる", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rc-nogit-"));
  const server = await startServer();
  try {
    const r = await runHook(dir, server.url, {
      hook_event_name: "UserPromptSubmit", session_id: "s", cwd: dir, prompt: "x",
    });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr, "");
    assert.equal(server.received.length, 0);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("変更が多いとき（差分の指定を切り替えるとき）も、出力ファイルの中身は送らない", () =>
  withEnv(async ({ repo, server }) => {
    const s = makeSession(repo, server.url);
    await s.prompt("たくさん作って");
    mkdirSync(path.join(repo, "many"));
    for (let i = 0; i < 320; i++) writeFileSync(path.join(repo, "many", `f${i}.py`), `v = ${i}\n`);
    writeFileSync(path.join(repo, "many", "OUT.CSV"), "SECRET_ROW\n");
    await s.stop();
    assert.equal(server.received.length, 1);
    const p = server.received[0].body;
    assert.match(p.diff, /\+v = 319/);
    assert.ok(!p.diff.includes("SECRET_ROW"));
    assert.deepEqual(p.generatedFiles, ["many/OUT.CSV"]);
  }));

test("標準入力が壊れていても exit 0 で、stdout には何も出さない", async () => {
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], { env: GIT_ENV });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.on("close", (code) => resolve({ code, stdout }));
    child.stdin.end("これは JSON ではない");
  });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, "");
});
