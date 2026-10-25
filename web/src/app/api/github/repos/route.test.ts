import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError, ReposResponse } from "@/lib/api-types";
import { GET } from "./route";

const URL = "http://localhost:3000/api/github/repos";

function get(headers: Record<string, string>): Request {
  return new Request(URL, { headers });
}

describe("GET /api/github/repos", () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("このアプリの画面からなら一覧を返す（トークン無しなら tokenSet: false）", async () => {
    const res = await GET(
      get({ host: "localhost:3000", "sec-fetch-site": "same-origin" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as ReposResponse).toEqual({
      tokenSet: false,
      repos: [],
    });
  });

  it.each([
    [
      "ほかのサイトから",
      { host: "localhost:3000", "sec-fetch-site": "cross-site" },
    ],
    [
      "Origin が違う",
      { host: "localhost:3000", origin: "https://evil.example" },
    ],
    ["Host が localhost でない", { host: "evil.example" }],
  ])("%s は 403", async (_, headers) => {
    process.env.GITHUB_TOKEN = "ghp_dummy_token_for_tests";
    const res = await GET(get(headers));
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
