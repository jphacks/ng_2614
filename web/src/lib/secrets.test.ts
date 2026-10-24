import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  anthropicKey,
  ensureResearchCheckToken,
  githubToken,
  lastFour,
  readSecrets,
  researchCheckToken,
  writeSecrets,
} from "./secrets";

const ENV_NAMES = [
  "TAZUNA_CONFIG",
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "RESEARCH_CHECK_TOKEN",
] as const;

describe("secrets（接続の設定 F-18）", () => {
  const original = Object.fromEntries(
    ENV_NAMES.map((n) => [n, process.env[n]]),
  );
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tazuna-test-"));
    path = join(dir, "sub", "config.json");
    process.env.TAZUNA_CONFIG = path;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.RESEARCH_CHECK_TOKEN;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    for (const n of ENV_NAMES) {
      if (original[n] === undefined) delete process.env[n];
      else process.env[n] = original[n];
    }
  });

  it("ファイルが無ければ空、未設定", () => {
    expect(readSecrets()).toEqual({});
    expect(anthropicKey()).toEqual({ value: "", source: null });
  });

  it("保存したファイルは本人だけが読める（600）", () => {
    writeSecrets({ anthropicApiKey: "sk-dummy-0000-abcd" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "sub")).mode & 0o777).toBe(0o700);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      anthropicApiKey: "sk-dummy-0000-abcd",
    });
  });

  it("画面で入れた値を環境変数より優先し、無ければ環境変数を使う", () => {
    process.env.GITHUB_TOKEN = "env-token";
    expect(githubToken()).toEqual({ value: "env-token", source: "env" });
    writeSecrets({ githubToken: "app-token" });
    expect(githubToken()).toEqual({ value: "app-token", source: "app" });
  });

  it("null で消し、省略した項目は残す", () => {
    writeSecrets({ anthropicApiKey: "a-key", githubToken: "g-token" });
    writeSecrets({ anthropicApiKey: null });
    expect(readSecrets()).toEqual({ githubToken: "g-token" });
  });

  it("壊れたファイルは空として扱う", () => {
    writeSecrets({ githubToken: "g" });
    writeFileSync(path, "{ not json");
    expect(readSecrets()).toEqual({});
  });

  it("フックの合言葉は、環境変数を優先し、無ければ作って保存する", () => {
    process.env.RESEARCH_CHECK_TOKEN = "env-secret";
    expect(ensureResearchCheckToken()).toBe("env-secret");
    expect(readSecrets().researchCheckToken).toBeUndefined();

    delete process.env.RESEARCH_CHECK_TOKEN;
    const made = ensureResearchCheckToken();
    expect(made).toMatch(/^[0-9a-f]{64}$/);
    expect(researchCheckToken()).toBe(made);
    expect(ensureResearchCheckToken()).toBe(made); // 2 回目は作り直さない
  });

  it("保存できない場所なら、合言葉は空のまま", () => {
    process.env.TAZUNA_CONFIG = "/dev/null/nope/config.json";
    expect(ensureResearchCheckToken()).toBe("");
  });

  it("末尾4文字は、短すぎる値では出さない", () => {
    expect(lastFour("sk-ant-0123456789")).toBe("6789");
    expect(lastFour("short")).toBe("");
  });
});
