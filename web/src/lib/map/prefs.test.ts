import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Node には localStorage が無いので、メモリ上の代わりを window に置く
function stubWindow(broken = false) {
  const data = new Map<string, string>();
  const dispatched: string[] = [];
  const localStorage = {
    getItem: (k: string) => {
      if (broken) throw new Error("SecurityError");
      return data.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("SecurityError");
      data.set(k, v);
    },
    removeItem: (k: string) => {
      if (broken) throw new Error("SecurityError");
      data.delete(k);
    },
  };
  vi.stubGlobal("window", {
    localStorage,
    dispatchEvent: (e: Event) => {
      dispatched.push(e.type);
      return true;
    },
  });
  return { data, dispatched };
}

// モジュールの中に覚えている値を、テストごとに作り直す
async function load() {
  vi.resetModules();
  return import("./prefs");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getStripOpen / setStripOpen", () => {
  it("初期値は false（畳んでいる）", async () => {
    stubWindow();
    const { getStripOpen } = await load();
    expect(getStripOpen()).toBe(false);
  });

  it("開くと true、畳むと false になり、キーは rc.mapStripOpen", async () => {
    const { data } = stubWindow();
    const { getStripOpen, setStripOpen } = await load();
    setStripOpen(true);
    expect(getStripOpen()).toBe(true);
    expect(data.get("rc.mapStripOpen")).toBe("1");
    setStripOpen(false);
    expect(getStripOpen()).toBe(false);
    expect(data.has("rc.mapStripOpen")).toBe(false);
  });

  it("別のタブが書いた値も読める", async () => {
    const { data } = stubWindow();
    const { getStripOpen } = await load();
    data.set("rc.mapStripOpen", "1");
    expect(getStripOpen()).toBe(true);
  });

  it("切り替えたときに変更を知らせるイベントを出す", async () => {
    const { dispatched } = stubWindow();
    const { setStripOpen } = await load();
    setStripOpen(true);
    expect(dispatched).toEqual(["rc:map-strip-open"]);
  });

  it("サーバー側（window が無い）では false で、書き込みも落ちない", async () => {
    vi.stubGlobal("window", undefined);
    const { getStripOpen, setStripOpen } = await load();
    expect(getStripOpen()).toBe(false);
    expect(() => setStripOpen(true)).not.toThrow();
    expect(getStripOpen()).toBe(false);
  });

  it("localStorage が使えなくても落ちず、この画面の中では切り替わる", async () => {
    const { dispatched } = stubWindow(true);
    const { getStripOpen, setStripOpen } = await load();
    expect(getStripOpen()).toBe(false);
    expect(() => setStripOpen(true)).not.toThrow();
    expect(getStripOpen()).toBe(true);
    setStripOpen(false);
    expect(getStripOpen()).toBe(false);
    expect(dispatched).toHaveLength(2);
  });
});

describe("getStripOrientation / setStripOrientation", () => {
  it("初期値は horizontal（上の横の帯）", async () => {
    stubWindow();
    const { getStripOrientation } = await load();
    expect(getStripOrientation()).toBe("horizontal");
  });

  it("vertical にすると保存され、horizontal に戻すとキーが消える。キーは rc.mapStripOrientation", async () => {
    const { data } = stubWindow();
    const { getStripOrientation, setStripOrientation } = await load();
    setStripOrientation("vertical");
    expect(getStripOrientation()).toBe("vertical");
    expect(data.get("rc.mapStripOrientation")).toBe("vertical");
    setStripOrientation("horizontal");
    expect(getStripOrientation()).toBe("horizontal");
    expect(data.has("rc.mapStripOrientation")).toBe(false);
  });

  it("別のタブが書いた値も読める", async () => {
    const { data } = stubWindow();
    const { getStripOrientation } = await load();
    data.set("rc.mapStripOrientation", "vertical");
    expect(getStripOrientation()).toBe("vertical");
  });

  it("想定外の値が入っていたら horizontal", async () => {
    const { data } = stubWindow();
    const { getStripOrientation } = await load();
    data.set("rc.mapStripOrientation", "diagonal");
    expect(getStripOrientation()).toBe("horizontal");
    data.set("rc.mapStripOrientation", "");
    expect(getStripOrientation()).toBe("horizontal");
  });

  it("切り替えたときに変更を知らせるイベントを出す", async () => {
    const { dispatched } = stubWindow();
    const { setStripOrientation } = await load();
    setStripOrientation("vertical");
    expect(dispatched).toEqual(["rc:map-strip-orientation"]);
  });

  it("サーバー側（window が無い）では horizontal で、書き込みも落ちない", async () => {
    vi.stubGlobal("window", undefined);
    const { getStripOrientation, setStripOrientation } = await load();
    expect(getStripOrientation()).toBe("horizontal");
    expect(() => setStripOrientation("vertical")).not.toThrow();
    expect(getStripOrientation()).toBe("horizontal");
  });

  it("localStorage が使えなくても落ちず、この画面の中では切り替わる", async () => {
    const { dispatched } = stubWindow(true);
    const { getStripOrientation, setStripOrientation } = await load();
    expect(getStripOrientation()).toBe("horizontal");
    expect(() => setStripOrientation("vertical")).not.toThrow();
    expect(getStripOrientation()).toBe("vertical");
    setStripOrientation("horizontal");
    expect(getStripOrientation()).toBe("horizontal");
    expect(dispatched).toHaveLength(2);
  });

  it("帯を開くかどうかの保存とは別のキー・イベントを使う", async () => {
    const { data, dispatched } = stubWindow();
    const { getStripOpen, setStripOrientation } = await load();
    setStripOrientation("vertical");
    expect(getStripOpen()).toBe(false);
    expect(data.has("rc.mapStripOpen")).toBe(false);
    expect(dispatched).not.toContain("rc:map-strip-open");
  });
});

describe("getSideWidth / setSideWidth", () => {
  it("初期値は 208", async () => {
    stubWindow();
    const { getSideWidth } = await load();
    expect(getSideWidth()).toBe(208);
  });

  it("範囲に収めて保存し、初期値と同じなら消す", async () => {
    const { data, dispatched } = stubWindow();
    const { getSideWidth, setSideWidth } = await load();
    setSideWidth(300.4);
    expect(data.get("rc.mapSideWidth")).toBe("300");
    expect(getSideWidth()).toBe(300);
    setSideWidth(9999);
    expect(getSideWidth()).toBe(480);
    setSideWidth(10);
    expect(getSideWidth()).toBe(180);
    setSideWidth(208);
    expect(data.has("rc.mapSideWidth")).toBe(false);
    expect(dispatched).toEqual(Array(4).fill("rc:map-side-width"));
  });

  it("保存された値が壊れていれば初期値、範囲外なら収める", async () => {
    const { data } = stubWindow();
    const { getSideWidth } = await load();
    data.set("rc.mapSideWidth", "abc");
    expect(getSideWidth()).toBe(208);
    data.set("rc.mapSideWidth", "1000");
    expect(getSideWidth()).toBe(480);
  });

  it("保存できなくても、この画面の中では変わる", async () => {
    stubWindow(true);
    const { getSideWidth, setSideWidth } = await load();
    setSideWidth(320);
    expect(getSideWidth()).toBe(320);
  });
});

describe("useMediaQuery", () => {
  it("サーバー側と matchMedia が無いときは false", async () => {
    stubWindow(); // matchMedia の無い window
    const { useMediaQuery } = await load();
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    function Probe() {
      return createElement("span", null, String(useMediaQuery("(min-width: 1024px)")));
    }
    expect(renderToString(createElement(Probe))).toContain("false");
  });
});
