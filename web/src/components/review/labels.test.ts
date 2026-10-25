import { describe, expect, it } from "vitest";
import { circled, headline } from "./labels";

describe("headline", () => {
  it("最初の文（「。」まで）を返す", () => {
    expect(headline("analyze.py を作ってください。作ったら実行して確かめて。")).toBe(
      "analyze.py を作ってください。",
    );
  });

  it("1行目だけを使う", () => {
    expect(headline("評価を追加して\n詳しくは README")).toBe("評価を追加して");
  });

  it("長すぎるときは max 文字で切って「…」を付ける", () => {
    const long = "あ".repeat(60);
    expect(headline(long)).toBe(`${"あ".repeat(50)}…`);
    expect(headline(long, 10)).toBe(`${"あ".repeat(10)}…`);
  });

  it("空なら空文字", () => {
    expect(headline("")).toBe("");
  });
});

describe("circled", () => {
  it("1〜20 は丸数字にする", () => {
    expect(circled(1)).toBe("①");
    expect(circled(20)).toBe("⑳");
  });

  it("21 以上は括弧の数字にする", () => {
    expect(circled(21)).toBe("(21)");
  });
});
