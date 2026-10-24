import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommits,
  fetchDiff,
  GithubApiError,
  isLockfile,
  limitDiffFiles,
  mapCommit,
  mapDiff,
  mapGithubError,
  MAX_DIFF_FILES,
  MAX_PATCH_CHARS_PER_FILE,
  MAX_PATCH_CHARS_TOTAL,
  parseRepo,
  parseSha,
} from "./github";

const FAKE_TOKEN = "ghp_dummy_token_for_tests";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GithubApiError);
    expect((e as GithubApiError).status).toBe(status);
    return;
  }
  throw new Error("GithubApiError が投げられなかった");
}

describe("parseRepo", () => {
  it("owner/name を分解する", () => {
    expect(parseRepo("jphacks/ng_2614")).toEqual({
      owner: "jphacks",
      name: "ng_2614",
    });
    expect(parseRepo(" a-b/c.d-e_f ")).toEqual({ owner: "a-b", name: "c.d-e_f" });
  });

  it.each([
    null,
    undefined,
    "",
    "owner",
    "owner/",
    "/name",
    "a/b/c",
    "owner/na me",
    "owner/na?me",
    "-owner/name",
    "own_er/name",
    "owner/..",
    "owner/.",
    "../name",
    `${"a".repeat(40)}/name`,
    `owner/${"a".repeat(101)}`,
  ])("不正な repo は 400: %s", (value) => {
    expectApiError(() => parseRepo(value), 400);
  });

  it("エラーメッセージは日本語", () => {
    try {
      parseRepo("x");
    } catch (e) {
      expect((e as Error).message).toMatch(/owner\/name/);
    }
  });
});

describe("parseSha", () => {
  it("7〜40 文字の 16 進数を小文字にして返す", () => {
    expect(parseSha("ABCDEF1")).toBe("abcdef1");
    expect(parseSha("a".repeat(40))).toBe("a".repeat(40));
  });

  it.each([null, undefined, "", "abcdef", "g".repeat(7), "a".repeat(41), "abc/../1234"])(
    "不正な sha は 400: %s",
    (value) => {
      expectApiError(() => parseSha(value), 400);
    },
  );
});

describe("mapCommit", () => {
  it("CommitSummary に変換する", () => {
    expect(
      mapCommit({
        sha: "abc1234",
        html_url: "https://github.com/o/r/commit/abc1234",
        commit: {
          message: "feat: 追加\n\n本文",
          author: { name: "Yuki", date: "2026-10-24T01:00:00Z" },
        },
        author: { login: "yuki" },
      }),
    ).toEqual({
      sha: "abc1234",
      message: "feat: 追加\n\n本文",
      author: "Yuki",
      date: "2026-10-24T01:00:00Z",
      url: "https://github.com/o/r/commit/abc1234",
    });
  });

  it("author 名が無ければ login を使う", () => {
    const c = mapCommit({
      sha: "abc1234",
      commit: { message: "m", author: { date: "d" } },
      author: { login: "octocat" },
    });
    expect(c.author).toBe("octocat");
  });

  it("形が違えば 502", () => {
    expectApiError(() => mapCommit({ commit: {} }), 502);
    expectApiError(() => mapCommit(null), 502);
  });
});

describe("limitDiffFiles / mapDiff", () => {
  const file = (filename: string, patch?: string) => ({
    filename,
    status: "modified",
    additions: 1,
    deletions: 2,
    ...(patch === undefined ? {} : { patch }),
  });

  it("上限内ならそのまま返し truncated は false", () => {
    const { files, truncated } = limitDiffFiles([file("a.ts", "@@ x"), file("img.png")]);
    expect(truncated).toBe(false);
    expect(files).toEqual([
      { filename: "a.ts", status: "modified", additions: 1, deletions: 2, patch: "@@ x" },
      { filename: "img.png", status: "modified", additions: 1, deletions: 2 },
    ]);
  });

  it("ロックファイルの patch を落とし truncated にする（ファイル自体は残す）", () => {
    const { files, truncated } = limitDiffFiles([
      file("package-lock.json", "huge"),
      file("sub/dir/yarn.lock", "huge"),
      file("a.ts", "ok"),
    ]);
    expect(truncated).toBe(true);
    expect(files.map((f) => f.filename)).toEqual([
      "package-lock.json",
      "sub/dir/yarn.lock",
      "a.ts",
    ]);
    expect(files[0].patch).toBeUndefined();
    expect(files[1].patch).toBeUndefined();
    expect(files[2].patch).toBe("ok");
  });

  it("ロックファイルの patch が無ければ truncated にしない", () => {
    expect(limitDiffFiles([file("uv.lock")]).truncated).toBe(false);
  });

  it("ファイルごとの patch を上限で切る", () => {
    const { files, truncated } = limitDiffFiles([
      file("big.ts", "x".repeat(MAX_PATCH_CHARS_PER_FILE + 10)),
    ]);
    expect(truncated).toBe(true);
    expect(files[0].patch).toHaveLength(MAX_PATCH_CHARS_PER_FILE);
  });

  it("ちょうど上限なら truncated にしない", () => {
    const { files, truncated } = limitDiffFiles([
      file("a.ts", "x".repeat(MAX_PATCH_CHARS_PER_FILE)),
    ]);
    expect(truncated).toBe(false);
    expect(files[0].patch).toHaveLength(MAX_PATCH_CHARS_PER_FILE);
  });

  it("ファイル数の上限を超えた分は省く", () => {
    const raw = Array.from({ length: MAX_DIFF_FILES + 5 }, (_, i) => file(`f${i}.ts`));
    const { files, truncated } = limitDiffFiles(raw);
    expect(files).toHaveLength(MAX_DIFF_FILES);
    expect(truncated).toBe(true);
  });

  it("patch の合計の上限を超えたら残りを切り、以降は patch を付けない", () => {
    const perFile = MAX_PATCH_CHARS_PER_FILE;
    const count = Math.ceil(MAX_PATCH_CHARS_TOTAL / perFile) + 2;
    const raw = Array.from({ length: count }, (_, i) =>
      file(`f${i}.ts`, "x".repeat(perFile)),
    );
    const { files, truncated } = limitDiffFiles(raw);
    expect(truncated).toBe(true);
    const total = files.reduce((n, f) => n + (f.patch?.length ?? 0), 0);
    expect(total).toBe(MAX_PATCH_CHARS_TOTAL);
    expect(files).toHaveLength(count);
    expect(files[files.length - 1].patch).toBeUndefined();
  });

  it("mapDiff はコミット情報と files を DiffResponse にする", () => {
    const res = mapDiff({
      sha: "a".repeat(40),
      html_url: "https://github.com/o/r/commit/aaa",
      commit: { message: "fix: 直す" },
      files: [file("a.ts", "@@")],
    });
    expect(res).toEqual({
      sha: "a".repeat(40),
      message: "fix: 直す",
      url: "https://github.com/o/r/commit/aaa",
      files: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 2, patch: "@@" }],
      truncated: false,
    });
  });

  it("files が無いコミットは空配列", () => {
    expect(mapDiff({ sha: "abc1234", commit: { message: "m" } }).files).toEqual([]);
  });

  it("形が違えば 502", () => {
    expectApiError(() => mapDiff({ commit: {} }), 502);
    expectApiError(() => mapDiff({ sha: "a", commit: {}, files: "x" }), 502);
    expectApiError(() => mapDiff({ sha: "a", commit: {}, files: [{}] }), 502);
  });
});

describe("isLockfile", () => {
  it.each(["package-lock.json", "web/pnpm-lock.yaml", "poetry.lock", "uv.lock", "yarn.lock"])(
    "%s はロックファイル",
    (name) => expect(isLockfile(name)).toBe(true),
  );
  it.each(["package.json", "src/lock.ts", "locks/readme.md"])("%s は違う", (name) =>
    expect(isLockfile(name)).toBe(false),
  );
});

describe("mapGithubError", () => {
  const res = (status: number, headers?: Record<string, string>) =>
    new Response("{}", { status, headers });

  it("401 はトークン無効", () => {
    const e = mapGithubError(res(401));
    expect(e.status).toBe(401);
    expect(e.message).toContain("トークン");
  });

  it("404 は見つからない（private の案内つき）", () => {
    const e = mapGithubError(res(404));
    expect(e.status).toBe(404);
    expect(e.message).toContain("見つかりません");
    expect(e.message).toContain("GITHUB_TOKEN");
  });

  it("422 も見つからない扱い", () => {
    expect(mapGithubError(res(422)).status).toBe(404);
  });

  it("429 と、残りが 0 の 403 はレート制限", () => {
    expect(mapGithubError(res(429)).status).toBe(429);
    const e = mapGithubError(res(403, { "x-ratelimit-remaining": "0" }));
    expect(e.status).toBe(429);
    expect(e.message).toContain("レート制限");
    expect(mapGithubError(res(403, { "retry-after": "60" })).status).toBe(429);
  });

  it("レート制限ではない 403 とその他は 502", () => {
    expect(mapGithubError(res(403, { "x-ratelimit-remaining": "10" })).status).toBe(502);
    expect(mapGithubError(res(500)).status).toBe(502);
    expect(mapGithubError(res(503)).status).toBe(502);
  });
});

describe("fetchCommits / fetchDiff", () => {
  const fetchMock = vi.fn();
  const originalToken = process.env.GITHUB_TOKEN;

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

  const repo = { owner: "o", name: "r" };

  it("コミット一覧を取得して変換する（トークン無しなら Authorization を付けない）", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          sha: "abc1234",
          html_url: "u",
          commit: { message: "m", author: { name: "n", date: "d" } },
        },
      ]),
    );
    const res = await fetchCommits(repo);
    expect(res.commits).toEqual([
      { sha: "abc1234", message: "m", author: "n", date: "d", url: "u" },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/o/r/commits?per_page=30");
    expect(init.headers.Accept).toBe("application/vnd.github+json");
    expect(init.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("GITHUB_TOKEN があれば Bearer で送る", async () => {
    process.env.GITHUB_TOKEN = FAKE_TOKEN;
    fetchMock.mockResolvedValue(jsonResponse([]));
    await fetchCommits(repo);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
  });

  it("差分を取得して変換する", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        sha: "abc1234",
        html_url: "u",
        commit: { message: "m" },
        files: [{ filename: "a.ts", status: "added", additions: 3, deletions: 0, patch: "@@" }],
      }),
    );
    const res = await fetchDiff(repo, "abc1234");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/o/r/commits/abc1234");
    expect(res.files[0].filename).toBe("a.ts");
    expect(res.truncated).toBe(false);
  });

  it("GitHub のエラーを日本語のエラーに変え、トークンを含めない", async () => {
    process.env.GITHUB_TOKEN = FAKE_TOKEN;
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const err = await fetchCommits(repo).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GithubApiError);
    expect((err as GithubApiError).status).toBe(404);
    expect((err as GithubApiError).message).not.toContain(FAKE_TOKEN);
  });

  it("ネットワーク障害は 502（トークンを含めない）", async () => {
    process.env.GITHUB_TOKEN = FAKE_TOKEN;
    fetchMock.mockRejectedValue(new Error(`boom ${FAKE_TOKEN}`));
    const err = await fetchDiff(repo, "abc1234").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GithubApiError);
    expect((err as GithubApiError).status).toBe(502);
    expect((err as GithubApiError).message).not.toContain(FAKE_TOKEN);
  });

  it("JSON でない応答は 502", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    const err = await fetchCommits(repo).catch((e: unknown) => e);
    expect((err as GithubApiError).status).toBe(502);
  });
});
