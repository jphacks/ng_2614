"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/components/theme/format";
import { REPO_PATTERN } from "@/components/theme/ThemeForm";
import { fetchRepos } from "@/lib/api-client";
import type { RepoSummary } from "@/lib/api-types";
import { useDemoMode } from "@/lib/demo/mode";

type Props = {
  // 登録済みのリポジトリ（小文字の owner/name）→ そのプロジェクトの id
  registered: ReadonlyMap<string, string>;
  onSelect: (repo: string) => void;
};

type State =
  | { kind: "loading" }
  | { kind: "loaded"; tokenSet: boolean; repos: RepoSummary[] }
  | { kind: "error"; message: string };

// S-6 の 1 段階目：GitHub のリポジトリを一覧から選ぶ。一覧が使えないときは手で入力する
export function RepoPicker({ registered, onSelect }: Props) {
  const demoMode = useDemoMode();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchRepos()
      .then((res) => {
        if (!cancelled) setState({ kind: "loaded", ...res });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const registeredId = (repo: string) => registered.get(repo.toLowerCase());

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const repo = manual.trim();
    if (!REPO_PATTERN.test(repo)) {
      setManualError(
        "owner/name の形式で入力してください（例: tamaki-lab/my-experiment）",
      );
      return;
    }
    if (registeredId(repo)) {
      setManualError("このリポジトリのプロジェクトはもうあります");
      return;
    }
    onSelect(repo);
  };

  const listUsable = state.kind === "loaded" && state.tokenSet;
  const q = query.trim().toLowerCase();
  const repos =
    state.kind === "loaded"
      ? state.repos.filter(
          (r) =>
            !q ||
            r.fullName.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        )
      : [];

  return (
    <div className="space-y-4">
      {state.kind === "loading" && (
        <p className="text-sm text-gray-500">
          GitHub からリポジトリを読み込み中...
        </p>
      )}

      {state.kind === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          リポジトリの一覧を取得できませんでした：{state.message}
          <br />
          下の欄に owner/name を入力してください。
        </p>
      )}

      {state.kind === "loaded" && !state.tokenSet && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          GitHub のトークンが設定されていないため、一覧を出せません。
          <Link href="/settings" className="font-medium underline">
            設定画面の「接続」
          </Link>
          で入れるとリポジトリを選べるようになります。今は下の欄に owner/name
          を入力してください。
        </p>
      )}

      {listUsable && (
        <div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="リポジトリを名前で絞り込む"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoCapitalize="none"
            spellCheck={false}
          />
          {repos.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {state.repos.length === 0
                ? "読めるリポジトリがありません。"
                : "当てはまるリポジトリがありません。"}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200">
              {repos.map((repo) => {
                const themeId = registeredId(repo.fullName);
                return (
                  <li key={repo.fullName}>
                    {themeId ? (
                      <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3">
                        <RepoLabel repo={repo} />
                        <Link
                          href={`/themes/${themeId}`}
                          className="shrink-0 text-xs text-blue-700 underline"
                        >
                          登録済み：開く
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(repo.fullName)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50"
                      >
                        <RepoLabel repo={repo} />
                        <span className="shrink-0 text-xs text-blue-700">
                          選ぶ →
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {state.kind !== "loading" && (
        <form onSubmit={submitManual} noValidate>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">
              {listUsable
                ? "一覧に無いときは直接入力する"
                : "GitHub リポジトリ"}
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setManualError("");
                }}
                placeholder="tamaki-lab/my-experiment"
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button
                type="submit"
                className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                次へ
              </button>
            </div>
          </label>
          {manualError && (
            <p className="mt-1 text-xs text-red-600">{manualError}</p>
          )}
        </form>
      )}
    </div>
  );
}

function RepoLabel({ repo }: { repo: RepoSummary }) {
  return (
    <div className="min-w-0">
      <p className="break-all font-mono text-sm text-gray-900">
        {repo.fullName}
        {repo.private && (
          <span className="ml-2 inline-block whitespace-nowrap rounded border border-gray-300 px-1.5 py-0.5 font-sans text-[11px] text-gray-600">
            private
          </span>
        )}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
        {[
          repo.language,
          repo.pushedAt && `最後の push ${formatDate(repo.pushedAt)}`,
          repo.description,
        ]
          .filter(Boolean)
          .join(" ・ ")}
      </p>
    </div>
  );
}
