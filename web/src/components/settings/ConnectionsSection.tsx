"use client";

// 設定画面（S-8）の「接続」：Claude API キーと GitHub トークン（F-18）。
// 入れた値はサーバーが手元のファイルに保存する。ブラウザには残さず、画面には末尾4文字だけ出す

import { useEffect, useState } from "react";
import {
  fetchConnections,
  saveConnections,
  testConnection,
} from "@/lib/api-client";
import type {
  ConnectionName,
  ConnectionsResponse,
  ConnectionStatus,
} from "@/lib/api-types";

type Spec = {
  name: ConnectionName;
  label: string;
  envName: string;
  placeholder: string;
  usedFor: string;
  issueUrl: string;
  issueLabel: string;
  howTo: string;
};

const SPECS: Spec[] = [
  {
    name: "anthropic",
    label: "Claude API キー",
    envName: "ANTHROPIC_API_KEY",
    placeholder: "sk-ant-...",
    usedFor: "判定・先生モード・作業フローマップで AI を呼ぶのに使います。",
    issueUrl: "https://console.anthropic.com/settings/keys",
    issueLabel: "Anthropic Console で発行する",
    howTo:
      "Console の「API Keys」で「Create Key」を押し、表示されたキーを貼り付けます。",
  },
  {
    name: "github",
    label: "GitHub トークン",
    envName: "GITHUB_TOKEN",
    placeholder: "github_pat_... / ghp_...",
    usedFor:
      "リポジトリの一覧・コミット・差分を読むのに使います。無くても public のリポジトリは読めますが、回数の制限が厳しくなります。",
    issueUrl: "https://github.com/settings/personal-access-tokens/new",
    issueLabel: "GitHub でトークンを発行する",
    howTo:
      "Fine-grained token で、読ませたいリポジトリを選び、権限は Contents と Metadata の Read-only だけにします。",
  },
];

export function ConnectionsSection() {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchConnections()
      .then(setData)
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : "状態を読めませんでした"),
      );
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold">接続</h2>
      <p className="mt-1 text-sm text-gray-600">
        キーはこのアプリのサーバーが手元のファイル
        {data && (
          <code className="mx-1 rounded bg-gray-100 px-1 text-xs">
            {data.configPath}
          </code>
        )}
        に、本人だけが読める形で保存します。ブラウザには残さず、画面に値は出しません（末尾4文字だけ）。
      </p>
      {loadError && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </p>
      )}
      <div className="mt-3 space-y-3">
        {SPECS.map((spec) => (
          <ConnectionCard
            key={spec.name}
            spec={spec}
            status={data?.[spec.name]}
            onSaved={setData}
          />
        ))}
      </div>
    </section>
  );
}

function ConnectionCard({
  spec,
  status,
  onSaved,
}: {
  spec: Spec;
  status: ConnectionStatus | undefined;
  onSaved: (data: ConnectionsResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | "test" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (
    kind: "save" | "delete" | "test",
    action: () => Promise<{ ok: boolean; text: string } | null>,
  ) => {
    setBusy(kind);
    setNote(null);
    try {
      setNote(await action());
    } catch (e) {
      setNote({
        ok: false,
        text: e instanceof Error ? e.message : "うまくいきませんでした",
      });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      onSaved(await saveConnections({ [spec.name]: value.trim() }));
      setValue(""); // 入力欄にも残さない
      setEditing(false);
      const r = await testConnection({ target: spec.name });
      return { ok: r.ok, text: `保存しました。${r.message}` };
    });

  const remove = () => {
    if (
      !window.confirm(`画面で入れた${spec.label}を消します。よろしいですか？`)
    )
      return;
    return run("delete", async () => {
      onSaved(await saveConnections({ [spec.name]: null }));
      return { ok: true, text: "消しました" };
    });
  };

  const test = () =>
    run("test", async () => {
      const r = await testConnection({ target: spec.name });
      return { ok: r.ok, text: r.message };
    });

  const showForm = editing || status?.source === null;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{spec.label}</p>
          <StatusBadge status={status} />
        </div>
        {status && status.source !== null && !editing && (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={test}
              disabled={busy !== null}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === "test" ? "確かめています…" : "接続を確かめる"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-blue-700 hover:underline"
            >
              {status.source === "app" ? "入れ直す" : "画面で入れる"}
            </button>
            {status.source === "app" && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                削除
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{spec.usedFor}</p>
      {status?.source === "env" && (
        <p className="mt-1 text-xs text-gray-500">
          今は <code>web/.env.local</code> の {spec.envName}{" "}
          を使っています。画面で入れると、そちらが優先されます。
        </p>
      )}

      {showForm && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) void save();
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={spec.placeholder}
              autoComplete="off"
              spellCheck={false}
              aria-label={spec.label}
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={!value.trim() || busy !== null}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === "save" ? "保存しています…" : "保存して確かめる"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                }}
                className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                やめる
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            <a
              href={spec.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline"
            >
              {spec.issueLabel} ↗
            </a>
            <span className="ml-2">{spec.howTo}</span>
          </p>
        </form>
      )}

      {note && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            note.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {note.ok ? "✓ " : "✕ "}
          {note.text}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus | undefined }) {
  if (!status) {
    return <span className="text-xs text-gray-400">読み込み中…</span>;
  }
  const [text, cls] =
    status.source === "app"
      ? [
          status.last4 ? `設定済み（…${status.last4}）` : "設定済み",
          "bg-green-50 text-green-800",
        ]
      : status.source === "env"
        ? [".env.local の値を使用中", "bg-blue-50 text-blue-800"]
        : ["未設定", "bg-amber-50 text-amber-900"];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  );
}
