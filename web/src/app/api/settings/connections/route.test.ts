import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApiError, ConnectionsResponse } from "@/lib/api-types";
import { GET, PUT } from "./route";

const URL = "http://localhost:3000/api/settings/connections";
const FROM_APP = { host: "localhost:3000", "sec-fetch-site": "same-origin" };

function put(body: unknown, headers: Record<string, string> = FROM_APP) {
  return new Request(URL, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/settings/connections", () => {
  const original = {
    config: process.env.TAZUNA_CONFIG,
    anthropic: process.env.ANTHROPIC_API_KEY,
    github: process.env.GITHUB_TOKEN,
  };
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tazuna-test-"));
    path = join(dir, "config.json");
    process.env.TAZUNA_CONFIG = path;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("TAZUNA_CONFIG", original.config);
    restore("ANTHROPIC_API_KEY", original.anthropic);
    restore("GITHUB_TOKEN", original.github);
  });

  it("GET は状態だけを返し、値は返さない", async () => {
    process.env.GITHUB_TOKEN = "env-token-value";
    const res = await GET(new Request(URL, { headers: FROM_APP }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ConnectionsResponse;
    expect(body.anthropic).toEqual({ source: null, last4: "" });
    expect(body.github).toEqual({ source: "env", last4: "" });
    expect(JSON.stringify(body)).not.toContain("env-token-value");
  });

  it("PUT で保存し、末尾4文字だけを返す", async () => {
    const res = await PUT(put({ anthropic: "sk-ant-dummy-12345678" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("sk-ant-dummy");
    expect((JSON.parse(text) as ConnectionsResponse).anthropic).toEqual({
      source: "app",
      last4: "5678",
    });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      anthropicApiKey: "sk-ant-dummy-12345678",
    });
  });

  it("PUT で null を送ると消す", async () => {
    await PUT(
      put({ anthropic: "sk-ant-dummy-12345678", github: "ghp_dummy_abcdefgh" }),
    );
    const res = await PUT(put({ anthropic: null }));
    const body = (await res.json()) as ConnectionsResponse;
    expect(body.anthropic.source).toBeNull();
    expect(body.github).toEqual({ source: "app", last4: "efgh" });
  });

  it("空白の入った値や知らない項目は断り、値をエラーに出さない", async () => {
    const res = await PUT(put({ github: "abc def-secret" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiError).error).not.toContain("secret");
    expect((await PUT(put({ other: "x" }))).status).toBe(400);
  });

  it.each([
    [
      "ほかのサイトから",
      { host: "localhost:3000", "sec-fetch-site": "cross-site" },
    ],
    [
      "localhost 以外の Host",
      { host: "example.com", "sec-fetch-site": "same-origin" },
    ],
  ])("%s は断る", async (_label, headers) => {
    expect((await GET(new Request(URL, { headers }))).status).toBe(403);
    expect(
      (await PUT(put({ github: "ghp_dummy_abcdefgh" }, headers))).status,
    ).toBe(403);
  });
});
