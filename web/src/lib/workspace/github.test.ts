import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GithubApiError } from "@/lib/github";
import {
  changedPathsSince,
  fetchWorkspaceFiles,
  fetchWorkspaceHead,
  listWorkspacePaths,
  MAX_FILE_CHARS,
} from "./github";

const REPO = { owner: "me", name: "research-workspace" };
const SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const API = "https://api.github.com/repos/me/research-workspace";
const FAKE_TOKEN = "ghp_dummy_token_for_tests";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function fileResponse(text: string): Response {
  const base64 = Buffer.from(text, "utf8").toString("base64");
  return jsonResponse({
    type: "file",
    encoding: "base64",
    // GitHub は base64 を 60 文字ごとに改行して返す
    content: base64.replace(/(.{60})/g, "$1\n"),
  });
}

async function catchError(promise: Promise<unknown>): Promise<GithubApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(GithubApiError);
    return e as GithubApiError;
  }
  throw new Error("GithubApiError が投げられなかった");
}

const fetchMock = vi.fn();
const originalToken = process.env.GITHUB_TOKEN;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.GITHUB_TOKEN = FAKE_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
});

describe("fetchWorkspaceHead", () => {
  it("既定のブランチの最新コミットの SHA を返す", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ sha: SHA }]));
    expect(await fetchWorkspaceHead(REPO)).toBe(SHA);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/commits?per_page=1`);
  });

  it("コミットが無ければ 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    expect((await catchError(fetchWorkspaceHead(REPO))).status).toBe(404);
  });

  it("応答の形式が違えば 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "x" }));
    expect((await catchError(fetchWorkspaceHead(REPO))).status).toBe(502);
  });

  it("GitHub のエラーは GithubApiError に変えて、トークンを含めない", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const e = await catchError(fetchWorkspaceHead(REPO));
    expect(e.status).toBe(404);
    expect(e.message).not.toContain(FAKE_TOKEN);
  });
});

describe("listWorkspacePaths", () => {
  it("ツリーのファイル（blob）のパスだけを返す", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sha: SHA,
        truncated: false,
        tree: [
          { path: ".research", type: "tree" },
          { path: ".research/lab/projects/p/README.md", type: "blob" },
          { path: "vendor", type: "commit" },
          { path: "notes.md", type: "blob" },
        ],
      }),
    );
    expect(await listWorkspacePaths(REPO, SHA)).toEqual([
      ".research/lab/projects/p/README.md",
      "notes.md",
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/git/trees/${SHA}?recursive=1`,
    );
  });

  it("truncated のときも、読めた分を返す", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ truncated: true, tree: [{ path: "a.md", type: "blob" }] }),
    );
    expect(await listWorkspacePaths(REPO, SHA)).toEqual(["a.md"]);
  });

  it("tree が無ければ 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: SHA }));
    expect((await catchError(listWorkspacePaths(REPO, SHA))).status).toBe(502);
  });

  it("SHA が不正なら GitHub を呼ばずに 400", async () => {
    const e = await catchError(listWorkspacePaths(REPO, "../x"));
    expect(e.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchWorkspaceFiles", () => {
  it("contents API を ref 付きで呼び、base64 を UTF-8 として読む", async () => {
    fetchMock.mockResolvedValueOnce(
      fileResponse("# 見出し\n日本語の本文 🧪\n"),
    );
    const files = await fetchWorkspaceFiles(REPO, SHA, [
      ".research/lab/projects/p/specs/2026-10-24 spec#1.md",
    ]);
    expect(files).toEqual([
      {
        path: ".research/lab/projects/p/specs/2026-10-24 spec#1.md",
        text: "# 見出し\n日本語の本文 🧪\n",
      },
    ]);
    // 区切りの "/" は残し、各区間をエスケープする
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/contents/.research/lab/projects/p/specs/2026-10-24%20spec%231.md?ref=${SHA}`,
    );
  });

  it("MAX_FILE_CHARS で切る", async () => {
    fetchMock.mockResolvedValueOnce(
      fileResponse("あ".repeat(MAX_FILE_CHARS + 500)),
    );
    const [file] = await fetchWorkspaceFiles(REPO, SHA, ["big.md"]);
    expect(file.text).toHaveLength(MAX_FILE_CHARS);
  });

  it("読めなかったファイル（404・ディレクトリ・大きすぎる・壊れている）は飛ばし、順番は保つ", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/ok1.md")) return fileResponse("one");
      if (url.includes("/gone.md")) return new Response("{}", { status: 404 });
      if (url.includes("/dir")) return jsonResponse([{ type: "file" }]);
      if (url.includes("/huge.md")) {
        return jsonResponse({ type: "file", encoding: "none", content: "" });
      }
      if (url.includes("/broken.md")) {
        return new Response("<html>", { status: 200 });
      }
      if (url.includes("/ok2.md")) return fileResponse("two");
      throw new Error("想定外の URL");
    });
    const files = await fetchWorkspaceFiles(REPO, SHA, [
      "ok1.md",
      "gone.md",
      "dir",
      "huge.md",
      "broken.md",
      "ok2.md",
    ]);
    expect(files.map((f) => f.path)).toEqual(["ok1.md", "ok2.md"]);
    expect(files.map((f) => f.text)).toEqual(["one", "two"]);
  });

  it("同時に読むのは8本まで", async () => {
    let running = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return fileResponse("x");
    });
    const paths = Array.from({ length: 30 }, (_, i) => `f${i}.md`);
    const files = await fetchWorkspaceFiles(REPO, SHA, paths);
    expect(files.map((f) => f.path)).toEqual(paths);
    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(peak).toBe(8);
  });

  it("パスが空なら GitHub を呼ばない", async () => {
    expect(await fetchWorkspaceFiles(REPO, SHA, [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("トークンが無効・レート制限は、飛ばさずに投げる", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    const unauthorized = await catchError(
      fetchWorkspaceFiles(REPO, SHA, ["a.md", "b.md"]),
    );
    expect(unauthorized.status).toBe(401);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    const limited = await catchError(fetchWorkspaceFiles(REPO, SHA, ["a.md"]));
    expect(limited.status).toBe(429);
  });

  it("接続できないファイルは飛ばす", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    fetchMock.mockResolvedValueOnce(fileResponse("ok"));
    const files = await fetchWorkspaceFiles(REPO, SHA, ["a.md", "b.md"]);
    expect(files.map((f) => f.path)).toEqual(["b.md"]);
  });
});

describe("changedPathsSince", () => {
  it("compare の files から、消えたファイル以外のパスを返す", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          { filename: "a.md", status: "modified" },
          { filename: "b.md", status: "added" },
          { filename: "c.md", status: "removed" },
          {
            filename: "d-new.md",
            status: "renamed",
            previous_filename: "d-old.md",
          },
        ],
      }),
    );
    expect(await changedPathsSince(REPO, OLD_SHA, SHA)).toEqual([
      "a.md",
      "b.md",
      "d-new.md",
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/compare/${OLD_SHA}...${SHA}`,
    );
  });

  it("files が無ければ空の一覧", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "identical" }));
    expect(await changedPathsSince(REPO, SHA, SHA)).toEqual([]);
  });

  it("base が見つからなければ 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const e = await catchError(changedPathsSince(REPO, OLD_SHA, SHA));
    expect(e.status).toBe(404);
  });

  it("files の形式が違えば 502", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ files: [{ status: "added" }] }),
    );
    const e = await catchError(changedPathsSince(REPO, OLD_SHA, SHA));
    expect(e.status).toBe(502);
  });
});
