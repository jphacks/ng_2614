"use client";

import { useState, type FormEvent } from "react";

export type WorkspaceValues = {
  workspaceRepo: string; // "owner/name"
  workspaceProject: string; // .research/lab/projects/<project> の <project>
};

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// GitHub の URL や .git が付いていても受け付ける。入力として正しくなければ undefined
export function normalizeRepo(input: string): string | undefined {
  const value = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  return REPO_PATTERN.test(value) ? value : undefined;
}

export function normalizeProject(input: string): string | undefined {
  const value = input.trim();
  if (!value || value === "." || value === "..") return undefined;
  return /[\s/\\]/.test(value) ? undefined : value;
}

// ワークスペースの中身を AI に送ることの説明。作る前と、設定の近くに出す
export function WorkspaceSendNotice() {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      ワークスペースの中身（壁打ち・spec・マイルストーンなどの文書）は、タスクや目的を作るために AI（Claude）へ送られます。
      AI に見せたくない内容は、ワークスペースに置かないでください。
    </p>
  );
}

// research-workspace（GitHub のリポジトリと、その中のプロジェクト名）の入力。
// 最初にマップを作るときと、S-7 の設定で使う
export function WorkspaceForm({
  initialRepo = "",
  initialProject = "",
  submitLabel,
  busyLabel,
  busy = false,
  onSubmit,
  onCancel,
}: {
  initialRepo?: string;
  initialProject?: string;
  submitLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onSubmit: (values: WorkspaceValues) => void;
  onCancel?: () => void;
}) {
  const [repo, setRepo] = useState(initialRepo);
  const [project, setProject] = useState(initialProject);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const workspaceRepo = normalizeRepo(repo);
    const workspaceProject = normalizeProject(project);
    setRepoError(
      workspaceRepo
        ? null
        : "owner/name の形で入力してください（例：my-team/research-workspace）",
    );
    setProjectError(
      workspaceProject
        ? null
        : "プロジェクト名を入力してください（空白と / は使えません）",
    );
    if (!workspaceRepo || !workspaceProject) return;
    onSubmit({ workspaceRepo, workspaceProject });
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 disabled:bg-gray-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div>
        <label
          htmlFor="workspace-repo"
          className="block text-sm font-medium text-gray-800"
        >
          research-workspace のリポジトリ
        </label>
        <input
          id="workspace-repo"
          type="text"
          value={repo}
          disabled={busy}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/name"
          autoComplete="off"
          aria-invalid={repoError ? true : undefined}
          aria-describedby={repoError ? "workspace-repo-error" : undefined}
          className={inputClass}
        />
        {repoError && (
          <p
            id="workspace-repo-error"
            role="alert"
            className="mt-1 text-xs text-red-700"
          >
            {repoError}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="workspace-project"
          className="block text-sm font-medium text-gray-800"
        >
          プロジェクト名
        </label>
        <p className="text-xs text-gray-500">
          <code className="font-mono">.research/lab/projects/</code>
          の下にあるフォルダ名です。
        </p>
        <input
          id="workspace-project"
          type="text"
          value={project}
          disabled={busy}
          onChange={(e) => setProject(e.target.value)}
          placeholder="例：diffusion-noise-schedule"
          autoComplete="off"
          aria-invalid={projectError ? true : undefined}
          aria-describedby={projectError ? "workspace-project-error" : undefined}
          className={inputClass}
        />
        {projectError && (
          <p
            id="workspace-project-error"
            role="alert"
            className="mt-1 text-xs text-red-700"
          >
            {projectError}
          </p>
        )}
      </div>
      <WorkspaceSendNotice />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? (busyLabel ?? submitLabel) : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
