// 判定ごとのコードの差分の保存（F-14）。localStorage では容量が足りないので、ブラウザの IndexedDB に置く。
// 画面（クライアントコンポーネント）からだけ呼ぶ。IndexedDB が使えない環境では、保存せず undefined を返す。

import type { DiffResponse } from "./api-types";
import { getLegacyHookDiff } from "./storage";

const DB_NAME = "rc";
const DB_VERSION = 1;
const STORE = "diffs"; // キーは Review.id

function openDb(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
    req.onblocked = () => resolve(undefined);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const req = body(tx.objectStore(STORE));
          tx.oncomplete = () => {
            db.close();
            resolve(req.result);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(undefined);
          };
        } catch {
          db.close();
          resolve(undefined);
        }
      }),
  );
}

// 保存できたら true。容量不足などで保存できなくても、判定の保存は止めない
export async function saveDiff(
  reviewId: string,
  commit: DiffResponse,
): Promise<boolean> {
  const key = await run("readwrite", (s) => s.put(commit, reviewId));
  return key !== undefined;
}

// IndexedDB に無ければ、F-14 より前に localStorage に残していたフックの差分を探す
export async function getDiff(
  reviewId: string,
): Promise<DiffResponse | undefined> {
  const stored = await run<DiffResponse | undefined>("readonly", (s) =>
    s.get(reviewId),
  );
  return stored ?? getLegacyHookDiff(reviewId);
}

export async function deleteDiff(reviewId: string): Promise<void> {
  await run("readwrite", (s) => s.delete(reviewId));
}
