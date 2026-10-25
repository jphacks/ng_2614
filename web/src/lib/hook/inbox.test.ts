import { beforeEach, describe, expect, it } from "vitest";
import {
  addHookChange,
  clearHookInbox,
  listHookChanges,
  MAX_INBOX_ITEMS,
  takeHookChange,
  type NewHookChange,
} from "./inbox";

function sample(prompt: string): NewHookChange {
  return {
    repo: "owner/name",
    sessionId: "s1",
    prompt,
    earlierPrompts: [],
    generatedFiles: [],
    observedErrors: [],
    headMoved: false,
    createdAt: "2026-10-24T00:00:00.000Z",
    files: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 0 }],
    truncated: false,
  };
}

describe("inbox", () => {
  beforeEach(() => clearHookInbox());

  it("id と receivedAt を振って置き、一覧は古い順で軽い", () => {
    const first = addHookChange(sample("one"));
    const second = addHookChange(sample("two"));
    expect(first.id).not.toBe(second.id);
    expect(Number.isNaN(Date.parse(first.receivedAt))).toBe(false);

    const list = listHookChanges();
    expect(list.map((c) => c.prompt)).toEqual(["one", "two"]);
    expect(Object.keys(list[0]).sort()).toEqual(
      ["createdAt", "id", "prompt", "receivedAt", "repo"].sort(),
    );
  });

  it("take は中身を返して消す。無ければ undefined", () => {
    const added = addHookChange(sample("one"));
    const taken = takeHookChange(added.id);
    expect(taken?.id).toBe(added.id);
    expect(taken?.files).toHaveLength(1);
    expect(takeHookChange(added.id)).toBeUndefined();
    expect(listHookChanges()).toEqual([]);
    expect(takeHookChange("missing")).toBeUndefined();
  });

  it("50 件を超えたら古いものから消す", () => {
    const first = addHookChange(sample("p0"));
    for (let i = 1; i <= MAX_INBOX_ITEMS; i++) addHookChange(sample(`p${i}`));
    const list = listHookChanges();
    expect(MAX_INBOX_ITEMS).toBe(50);
    expect(list).toHaveLength(50);
    expect(list[0].prompt).toBe("p1");
    expect(list[49].prompt).toBe("p50");
    expect(takeHookChange(first.id)).toBeUndefined();
  });
});
