import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkHookToken,
  hasOriginHeader,
  isFromThisApp,
  isHookEnabled,
  isLocalHost,
} from "./guard";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/hook/changes", { headers });
}

describe("isLocalHost", () => {
  it.each([
    "localhost",
    "localhost:3000",
    "LOCALHOST:8080",
    "127.0.0.1",
    "127.0.0.1:3000",
    "[::1]",
    "[::1]:3000",
  ])("%s は通す", (host) => {
    expect(isLocalHost(req({ host }))).toBe(true);
  });

  it.each([
    "example.com",
    "localhost.evil.com",
    "evil.com:3000",
    "192.168.0.10:3000",
    "0.0.0.0:3000",
    "127.0.0.1.evil.com",
    "",
  ])("%j は断る", (host) => {
    expect(isLocalHost(req({ host }))).toBe(false);
  });

  it("Host ヘッダーが無ければ断る", () => {
    expect(isLocalHost(req({}))).toBe(false);
  });
});

describe("checkHookToken", () => {
  const original = process.env.RESEARCH_CHECK_TOKEN;
  beforeEach(() => {
    process.env.RESEARCH_CHECK_TOKEN = "test-token";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.RESEARCH_CHECK_TOKEN;
    else process.env.RESEARCH_CHECK_TOKEN = original;
  });

  it("合言葉が合えば ok", () => {
    expect(checkHookToken(req({ authorization: "Bearer test-token" }))).toBe(
      "ok",
    );
    expect(checkHookToken(req({ authorization: "bearer test-token" }))).toBe(
      "ok",
    );
  });

  it("違う・長さが違う・形式が違う・無いときは invalid", () => {
    expect(checkHookToken(req({ authorization: "Bearer test-tokeX" }))).toBe(
      "invalid",
    );
    expect(checkHookToken(req({ authorization: "Bearer short" }))).toBe(
      "invalid",
    );
    expect(
      checkHookToken(req({ authorization: "Bearer test-token-and-more" })),
    ).toBe("invalid");
    expect(checkHookToken(req({ authorization: "test-token" }))).toBe(
      "invalid",
    );
    expect(checkHookToken(req({ authorization: "Bearer " }))).toBe("invalid");
    expect(checkHookToken(req({}))).toBe("invalid");
  });

  it("サーバーに合言葉が無い（空・空白だけ）ときは disabled", () => {
    delete process.env.RESEARCH_CHECK_TOKEN;
    expect(isHookEnabled()).toBe(false);
    expect(checkHookToken(req({ authorization: "Bearer test-token" }))).toBe(
      "disabled",
    );
    process.env.RESEARCH_CHECK_TOKEN = "  ";
    expect(isHookEnabled()).toBe(false);
    expect(checkHookToken(req({ authorization: "Bearer " }))).toBe("disabled");
  });
});

describe("isFromThisApp", () => {
  const host = "localhost:3000";

  it("Sec-Fetch-Site / Origin が無ければ通す（curl など）", () => {
    expect(isFromThisApp(req({ host }))).toBe(true);
  });

  it("same-origin と none は通す", () => {
    expect(isFromThisApp(req({ host, "sec-fetch-site": "same-origin" }))).toBe(
      true,
    );
    expect(isFromThisApp(req({ host, "sec-fetch-site": "none" }))).toBe(true);
  });

  it("cross-site / same-site は断る", () => {
    expect(isFromThisApp(req({ host, "sec-fetch-site": "cross-site" }))).toBe(
      false,
    );
    expect(isFromThisApp(req({ host, "sec-fetch-site": "same-site" }))).toBe(
      false,
    );
  });

  it("Origin のホストが Host と同じなら通し、違えば断る", () => {
    expect(isFromThisApp(req({ host, origin: "http://localhost:3000" }))).toBe(
      true,
    );
    expect(isFromThisApp(req({ host, origin: "http://localhost:3001" }))).toBe(
      false,
    );
    expect(isFromThisApp(req({ host, origin: "https://evil.example" }))).toBe(
      false,
    );
    expect(isFromThisApp(req({ host, origin: "null" }))).toBe(false);
  });
});

describe("hasOriginHeader", () => {
  it("Origin が付いていれば true", () => {
    expect(hasOriginHeader(req({ origin: "http://localhost:3000" }))).toBe(
      true,
    );
    expect(hasOriginHeader(req({}))).toBe(false);
  });
});
