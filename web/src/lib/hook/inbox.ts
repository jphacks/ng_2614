// フックから届いた変更を置いておく受け取り箱。サーバーのメモリだけに置く（データベースは使わない）。
// Next の開発サーバーはコードを書き換えるたびにモジュールを読み直すので、
// 中身は globalThis に置いて、読み直しても消えないようにする。

import type { HookChange, HookChangeSummary } from "../api-types";

export const MAX_INBOX_ITEMS = 50;

export type NewHookChange = Omit<HookChange, "id" | "receivedAt">;

type InboxStore = { items: HookChange[] };

const STORE_KEY = "__researchCheckHookInbox__";

function getStore(): InboxStore {
  const g = globalThis as unknown as Record<string, InboxStore | undefined>;
  let store = g[STORE_KEY];
  if (!store) {
    store = { items: [] };
    g[STORE_KEY] = store;
  }
  return store;
}

// 受け取り箱に置く。id と受け取った時刻はここで振る。50 件を超えたら古いものから消す
export function addHookChange(input: NewHookChange): HookChange {
  const store = getStore();
  const change: HookChange = {
    ...input,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  };
  store.items.push(change);
  while (store.items.length > MAX_INBOX_ITEMS) store.items.shift();
  return change;
}

// 古い順の一覧。差分などは含めない
export function listHookChanges(): HookChangeSummary[] {
  return getStore().items.map(
    ({ id, repo, prompt, createdAt, receivedAt }) => ({
      id,
      repo,
      prompt,
      createdAt,
      receivedAt,
    }),
  );
}

// 1 件取り出して、受け取り箱から消す。無ければ undefined
export function takeHookChange(id: string): HookChange | undefined {
  const store = getStore();
  const index = store.items.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  return store.items.splice(index, 1)[0];
}

// テスト用：空にする
export function clearHookInbox(): void {
  getStore().items = [];
}
