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
  placeholder: string;
  usedFor?: string; // 状態の下に出す補足（要るものだけ）
  issueUrl: string;
  issueLabel: string;
  howTo: string;
};

const SPECS: Spec[] = [
  {
    name: "anthropic",
    label: "Claude API キー",
    placeholder: "sk-ant-...",
    issueUrl: "https://console.anthropic.com/settings/keys",
    issueLabel: "Anthropic Console で発行する",
    howTo:
      "Console の「API Keys」で「Create Key」を押し、表示されたキーを貼り付けます。",
  },
  {
    name: "github",
    label: "GitHub トークン",
    placeholder: "github_pat_... / ghp_...",
    usedFor: "無くても public のリポジトリは読めますが、回数の制限が厳しくなります。",
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
      <h2 className="rule-head text-lg font-bold">接続</h2>
      <p className="mt-2 text-sm text-ink-2">
        キーはこのアプリのサーバーが手元のファイル
        {data && (
          <code className="mx-1 bg-paper-2 px-1 font-mono text-xs">
            {data.configPath}
          </code>
        )}
        に、本人だけが読める形で保存します。ブラウザには残さず、画面に値は出しません（末尾4文字だけ）。
      </p>
      {loadError && (
        <p className="mt-3 border-l-2 border-pen p-3 text-sm text-pen">
          {loadError}
        </p>
      )}
      <div className="mt-3 divide-y divide-hair border-y border-hair">
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
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{spec.label}</p>
          <StatusBadge status={status} />
        </div>
        {status && status.source !== null && !editing && (
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={test}
              disabled={busy !== null}
              className="btn btn-sm disabled:opacity-50"
            >
              {busy === "test" ? "確かめています…" : "接続を確かめる"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="link"
            >
              {status.source === "app" ? "入れ直す" : "画面で入れる"}
            </button>
            {status.source === "app" && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="text-pen underline decoration-pen/40 underline-offset-4 hover:decoration-pen disabled:opacity-50"
              >
                削除
              </button>
            )}
          </div>
        )}
      </div>
      {spec.usedFor && <p className="mt-1 text-xs text-ink-3">{spec.usedFor}</p>}

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
              className="field w-auto min-w-0 flex-1 font-mono"
            />
            <button
              type="submit"
              disabled={!value.trim() || busy !== null}
              className="btn"
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
                className="link-quiet px-3 py-2 text-sm"
              >
                やめる
              </button>
            )}
          </div>
          <p className="text-xs text-ink-3">
            <a
              href={spec.issueUrl}
              target="_blank"
              rel="noreferrer"
              className="link"
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
          className={`mt-3 border-l-2 px-3 py-2 text-sm ${
            note.ok ? "border-ink text-ink" : "border-pen text-pen"
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
    return <span className="text-xs text-ink-3">読み込み中…</span>;
  }
  const [text, cls] =
    status.source === "app"
      ? [
          status.last4 ? `設定済み（…${status.last4}）` : "設定済み",
          "text-ink",
        ]
      : status.source === "env"
        ? [".env.local の値を使用中", "text-ink-2"]
        : ["未設定", "bg-marker text-ink"]; // 未設定は注意なので蛍光ペン
  return (
    <span className={`tag ${cls}`}>
      {text}
    </span>
  );
}
