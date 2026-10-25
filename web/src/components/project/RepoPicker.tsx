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
        <p className="text-sm text-ink-3">
          GitHub からリポジトリを読み込み中...
        </p>
      )}

      {state.kind === "error" && (
        <p className="border-l-2 border-pen p-3 text-sm text-pen">
          リポジトリの一覧を取得できませんでした：{state.message}
          <br />
          下の欄に owner/name を入力してください。
        </p>
      )}

      {state.kind === "loaded" && !state.tokenSet && (
        <p className="border-l-2 border-ink bg-marker p-3 text-sm text-ink">
          GitHub のトークンが設定されていないため、一覧を出せません。
          <Link href="/settings" className="link font-medium">
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
            className="field"
            autoCapitalize="none"
            spellCheck={false}
          />
          {repos.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">
              {state.repos.length === 0
                ? "読めるリポジトリがありません。"
                : "当てはまるリポジトリがありません。"}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-hair overflow-hidden border-y border-ink">
              {repos.map((repo) => {
                const themeId = registeredId(repo.fullName);
                return (
                  <li key={repo.fullName}>
                    {themeId ? (
                      <div className="flex items-center justify-between gap-3 bg-paper-2 px-4 py-3">
                        <RepoLabel repo={repo} />
                        <Link
                          href={`/themes/${themeId}`}
                          className="link shrink-0 text-xs"
                        >
                          登録済み：開く
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(repo.fullName)}
                        className="flex w-full items-center justify-between gap-3 border-l-2 border-transparent px-4 py-3 text-left hover:border-ink hover:bg-paper-2"
                      >
                        <RepoLabel repo={repo} />
                        <span className="shrink-0 text-xs font-medium text-ink">
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
            <span className="label">
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
                className="field font-mono"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button
                type="submit"
                className="btn shrink-0"
              >
                次へ
              </button>
            </div>
          </label>
          {manualError && (
            <p className="mt-1 text-xs text-pen">{manualError}</p>
          )}
        </form>
      )}
    </div>
  );
}

function RepoLabel({ repo }: { repo: RepoSummary }) {
  return (
    <div className="min-w-0">
      <p className="break-all font-mono text-sm text-ink">
        {repo.fullName}
        {repo.private && (
          <span className="tag ml-2 font-sans text-ink-2">
            private
          </span>
        )}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-3">
        {repo.language && <span>{repo.language}</span>}
        {repo.pushedAt && <span>最後の push {formatDate(repo.pushedAt)}</span>}
      </p>
      {repo.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{repo.description}</p>
      )}
    </div>
  );
}
