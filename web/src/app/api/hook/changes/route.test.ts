import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ApiError,
  HookChangeAccepted,
  HookChangeResponse,
  HookChangesResponse,
} from "@/lib/api-types";
import { clearHookInbox, listHookChanges } from "@/lib/hook/inbox";
import { DELETE } from "./[id]/route";
import { GET, POST } from "./route";

const URL_BASE = "http://localhost:3000/api/hook/changes";

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-old
+new
 same
`;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    repo: "owner/name",
    sessionId: "session-1",
    prompt: "学習率を変えて",
    earlierPrompts: ["最初の依頼"],
    diff: DIFF,
    generatedFiles: ["results.csv"],
    observedErrors: [{ tool: "Bash", input: "python train.py", output: "boom" }],
    headMoved: false,
    createdAt: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

function post(
  body: unknown,
  headers: Record<string, string> = {},
  raw = false,
): Request {
  return new Request(URL_BASE, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      authorization: "Bearer test-token",
      "content-type": "application/json",
      ...headers,
    },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

function appRequest(
  method: "GET" | "DELETE",
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, {
    method,
    headers: { host: "localhost:3000", ...headers },
  });
}

const original = process.env.RESEARCH_CHECK_TOKEN;

beforeEach(() => {
  process.env.RESEARCH_CHECK_TOKEN = "test-token";
  clearHookInbox();
});
afterEach(() => {
  if (original === undefined) delete process.env.RESEARCH_CHECK_TOKEN;
  else process.env.RESEARCH_CHECK_TOKEN = original;
  clearHookInbox();
});

describe("POST /api/hook/changes", () => {
  it("正しいリクエストは 202 で id を返し、受け取り箱に置く", async () => {
    const res = await POST(post(payload()));
    expect(res.status).toBe(202);
    const body = (await res.json()) as HookChangeAccepted;
    expect(typeof body.id).toBe("string");
    const list = listHookChanges();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(body.id);
    expect(list[0].repo).toBe("owner/name");
  });

  it("localhost 以外の Host は 403", async () => {
    const res = await POST(post(payload(), { host: "evil.example.com" }));
    expect(res.status).toBe(403);
    expect(listHookChanges()).toHaveLength(0);
  });

  it("Origin が付いていたら 403（合言葉が合っていても）", async () => {
    const res = await POST(
      post(payload(), { origin: "http://localhost:3000" }),
    );
    expect(res.status).toBe(403);
  });

  it("サーバーに合言葉が無ければ 503", async () => {
    delete process.env.RESEARCH_CHECK_TOKEN;
    const res = await POST(post(payload()));
    expect(res.status).toBe(503);
    const body = (await res.json()) as ApiError;
    expect(body.error).toContain("RESEARCH_CHECK_TOKEN");
    expect(body.error).toContain("web/.env.local");
  });

  it("合言葉が違う・無ければ 401", async () => {
    const wrong = await POST(
      post(payload(), { authorization: "Bearer wrong" }),
    );
    expect(wrong.status).toBe(401);
    const none = new Request(URL_BASE, {
      method: "POST",
      headers: { host: "localhost:3000" },
      body: JSON.stringify(payload()),
    });
    expect((await POST(none)).status).toBe(401);
    const body = (await wrong.json()) as ApiError;
    expect(body.error).not.toContain("test-token");
  });

  it("本文が 2,000,000 文字を超えたら 413", async () => {
    const res = await POST(post("x".repeat(2_000_001), {}, true));
    expect(res.status).toBe(413);
  });

  it("JSON でなければ 400", async () => {
    const res = await POST(post("{not json", {}, true));
    expect(res.status).toBe(400);
  });

  it("形が違えば 400", async () => {
    expect((await POST(post({ prompt: "x" }))).status).toBe(400);
    expect((await POST(post(payload({ diff: 1 })))).status).toBe(400);
    expect((await POST(post(payload({ headMoved: "yes" })))).status).toBe(400);
    expect((await POST(post(payload({ observedErrors: [{}] })))).status).toBe(
      400,
    );
    expect((await POST(post(null))).status).toBe(400);
  });

  it("差分から変更されたファイルが読み取れなければ 400", async () => {
    expect((await POST(post(payload({ diff: "" })))).status).toBe(400);
    expect((await POST(post(payload({ diff: "not a diff" })))).status).toBe(
      400,
    );
    expect(listHookChanges()).toHaveLength(0);
  });

  it("件数と長さの上限を超えた分は切り詰める", async () => {
    const res = await POST(
      post(
        payload({
          earlierPrompts: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
          observedErrors: Array.from({ length: 12 }, (_, i) => ({
            tool: "Bash",
            input: "i".repeat(600) + i,
            output: "o".repeat(2500),
          })),
        }),
      ),
    );
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as HookChangeAccepted;
    const taken = await DELETE(
      appRequest("DELETE", `${URL_BASE}/${id}`),
      { params: Promise.resolve({ id }) },
    );
    const { change } = (await taken.json()) as HookChangeResponse;
    expect(change.earlierPrompts).toEqual(["p3", "p4", "p5", "p6", "p7"]);
    expect(change.observedErrors).toHaveLength(10);
    expect(change.observedErrors[0].input).toHaveLength(500);
    expect(change.observedErrors[0].output).toHaveLength(2000);
    expect(change.files[0].filename).toBe("src/a.ts");
    expect(change.truncated).toBe(false);
    expect("diff" in change).toBe(false);
  });
});

describe("GET /api/hook/changes", () => {
  it("enabled と一覧（古い順、差分は含まない）を返す", async () => {
    await POST(post(payload({ prompt: "one" })));
    await POST(post(payload({ prompt: "two" })));
    const res = await GET(appRequest("GET", URL_BASE));
    expect(res.status).toBe(200);
    const body = (await res.json()) as HookChangesResponse;
    expect(body.enabled).toBe(true);
    expect(body.changes.map((c) => c.prompt)).toEqual(["one", "two"]);
    expect("files" in body.changes[0]).toBe(false);
  });

  it("合言葉が無ければ enabled: false で一覧は空", async () => {
    await POST(post(payload()));
    delete process.env.RESEARCH_CHECK_TOKEN;
    const res = await GET(appRequest("GET", URL_BASE));
    const body = (await res.json()) as HookChangesResponse;
    expect(body).toEqual({ enabled: false, changes: [] });
  });

  it("localhost 以外は 403", async () => {
    const res = await GET(
      appRequest("GET", URL_BASE, { host: "evil.example.com" }),
    );
    expect(res.status).toBe(403);
  });

  it("ほかのサイトからのリクエストは 403", async () => {
    expect(
      (
        await GET(
          appRequest("GET", URL_BASE, { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await GET(
          appRequest("GET", URL_BASE, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await GET(
          appRequest("GET", URL_BASE, {
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin",
          }),
        )
      ).status,
    ).toBe(200);
  });
});

describe("DELETE /api/hook/changes/[id]", () => {
  async function addOne(): Promise<string> {
    const res = await POST(post(payload()));
    return ((await res.json()) as HookChangeAccepted).id;
  }
  const call = (id: string, headers: Record<string, string> = {}) =>
    DELETE(appRequest("DELETE", `${URL_BASE}/${id}`, headers), {
      params: Promise.resolve({ id }),
    });

  it("中身を返して削除し、2 回目は 404", async () => {
    const id = await addOne();
    const first = await call(id);
    expect(first.status).toBe(200);
    const { change } = (await first.json()) as HookChangeResponse;
    expect(change.id).toBe(id);
    expect(change.prompt).toBe("学習率を変えて");
    expect(change.files).toHaveLength(1);
    expect(listHookChanges()).toHaveLength(0);

    const second = await call(id);
    expect(second.status).toBe(404);
    const body = (await second.json()) as ApiError;
    expect(typeof body.error).toBe("string");
  });

  it("localhost 以外・ほかのサイトからは 403 で、削除されない", async () => {
    const id = await addOne();
    expect((await call(id, { host: "evil.example.com" })).status).toBe(403);
    expect((await call(id, { "sec-fetch-site": "cross-site" })).status).toBe(
      403,
    );
    expect((await call(id, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect(listHookChanges()).toHaveLength(1);
  });
});
