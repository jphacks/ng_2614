// GitHub REST API からコミットと差分を取得する（サーバー側だけで使う）。
// 差分は後で LLM に渡すので、サイズに上限を設けて切り詰める。
// GITHUB_TOKEN の値は、ログにもエラーメッセージにも出さない。

import type {
  CommitsResponse,
  CommitSummary,
  DiffFile,
  DiffResponse,
} from "./api-types";

const GITHUB_API_BASE = "https://api.github.com";
const FETCH_TIMEOUT_MS = 15_000;

// コミット一覧の取得件数
export const COMMITS_PER_PAGE = 30;

// 差分のサイズ上限（LLM に送るため）
export const MAX_DIFF_FILES = 50;
export const MAX_PATCH_CHARS_PER_FILE = 20_000;
export const MAX_PATCH_CHARS_TOTAL = 150_000;

// patch を送らないファイル名（ディレクトリを除いた名前で比べる）
export const LOCKFILE_NAMES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "poetry.lock",
  "pdm.lock",
  "uv.lock",
  "Pipfile.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
  "pubspec.lock",
  "Podfile.lock",
  "flake.lock",
]);

// ルート側で HTTP ステータスと日本語メッセージにそのまま変換できるエラー
export class GithubApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
  }
}

// ---- 入力の検証 ----

export type Repo = { owner: string; name: string };

// owner: 英数字とハイフン（先頭は英数字、39 文字まで）
// name: 英数字・ハイフン・アンダースコア・ピリオド（100 文字まで。"." と ".." は不可）
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;

export function parseRepo(raw: string | null | undefined): Repo {
  const value = (raw ?? "").trim();
  const parts = value.split("/");
  if (parts.length !== 2) {
    throw new GithubApiError(
      "repo は owner/name の形式で指定してください（例：jphacks/ng_2614）",
      400,
    );
  }
  const [owner, name] = parts;
  if (
    !OWNER_PATTERN.test(owner) ||
    !REPO_NAME_PATTERN.test(name) ||
    name === "." ||
    name === ".."
  ) {
    throw new GithubApiError(
      "repo に使えない文字が含まれています。owner/name の形式で指定してください",
      400,
    );
  }
  return { owner, name };
}

export function parseSha(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!SHA_PATTERN.test(value)) {
    throw new GithubApiError(
      "sha は 7〜40 文字の 16 進数で指定してください",
      400,
    );
  }
  return value.toLowerCase();
}

// ---- GitHub への問い合わせ ----

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function isRateLimited(res: Response): boolean {
  if (res.status === 429) return true;
  if (res.status !== 403) return false;
  return (
    res.headers.get("x-ratelimit-remaining") === "0" ||
    res.headers.has("retry-after")
  );
}

// GitHub のエラー応答を日本語のメッセージに変える。トークンやレスポンス本文は含めない
export function mapGithubError(res: Response): GithubApiError {
  if (res.status === 401) {
    return new GithubApiError(
      "GitHub のトークンが無効です。GITHUB_TOKEN を確認してください",
      401,
    );
  }
  // 422 は、存在しない sha を指定したときに GitHub が返す
  if (res.status === 404 || res.status === 422) {
    return new GithubApiError(
      "リポジトリまたはコミットが見つかりません。private リポジトリの場合は GITHUB_TOKEN の権限を確認してください",
      404,
    );
  }
  if (isRateLimited(res)) {
    return new GithubApiError(
      "GitHub API のレート制限に達しました。しばらく待つか、GITHUB_TOKEN を設定してください",
      429,
    );
  }
  if (res.status === 403) {
    return new GithubApiError(
      "GitHub にアクセスできませんでした（403）。GITHUB_TOKEN の権限を確認してください",
      502,
    );
  }
  return new GithubApiError(
    `GitHub API でエラーが発生しました（${res.status}）`,
    502,
  );
}

async function githubGet(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: buildHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new GithubApiError("GitHub API に接続できませんでした", 502);
  }
  if (!res.ok) {
    throw mapGithubError(res);
  }
  try {
    return await res.json();
  } catch {
    throw new GithubApiError("GitHub API の応答を読み取れませんでした", 502);
  }
}

function invalidResponse(): GithubApiError {
  return new GithubApiError("GitHub API の応答の形式が想定と違います", 502);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// ---- コミット一覧 ----

export function mapCommit(raw: unknown): CommitSummary {
  const item = asRecord(raw);
  const commit = asRecord(item?.commit);
  if (!item || !commit || typeof item.sha !== "string") {
    throw invalidResponse();
  }
  const commitAuthor = asRecord(commit.author);
  const accountAuthor = asRecord(item.author);
  return {
    sha: item.sha,
    message: str(commit.message),
    author: str(commitAuthor?.name) || str(accountAuthor?.login),
    date: str(commitAuthor?.date),
    url: str(item.html_url),
  };
}

export function mapCommits(raw: unknown): CommitsResponse {
  if (!Array.isArray(raw)) throw invalidResponse();
  return { commits: raw.map(mapCommit) };
}

export async function fetchCommits(repo: Repo): Promise<CommitsResponse> {
  const raw = await githubGet(
    `/repos/${repo.owner}/${repo.name}/commits?per_page=${COMMITS_PER_PAGE}`,
  );
  return mapCommits(raw);
}

// ---- 差分 ----

export function isLockfile(filename: string): boolean {
  const base = filename.split("/").pop() ?? filename;
  return LOCKFILE_NAMES.has(base);
}

// ファイル数・ファイルごとの patch・patch の合計に上限をかけ、ロックファイルの patch を落とす。
// 何かを省いたら truncated を true にする
export function limitDiffFiles(rawFiles: unknown[]): {
  files: DiffFile[];
  truncated: boolean;
} {
  let truncated = rawFiles.length > MAX_DIFF_FILES;
  let remaining = MAX_PATCH_CHARS_TOTAL;
  const files: DiffFile[] = [];

  for (const raw of rawFiles.slice(0, MAX_DIFF_FILES)) {
    const item = asRecord(raw);
    if (!item || typeof item.filename !== "string") throw invalidResponse();

    const file: DiffFile = {
      filename: item.filename,
      status: str(item.status),
      additions: num(item.additions),
      deletions: num(item.deletions),
    };

    if (typeof item.patch === "string" && item.patch.length > 0) {
      if (isLockfile(item.filename)) {
        truncated = true;
      } else {
        const allowed = Math.min(MAX_PATCH_CHARS_PER_FILE, remaining);
        if (item.patch.length > allowed) truncated = true;
        if (allowed > 0) {
          file.patch = item.patch.slice(0, allowed);
          remaining -= file.patch.length;
        }
      }
    }
    files.push(file);
  }

  return { files, truncated };
}

export function mapDiff(raw: unknown): DiffResponse {
  const item = asRecord(raw);
  const commit = asRecord(item?.commit);
  if (!item || !commit || typeof item.sha !== "string") {
    throw invalidResponse();
  }
  const rawFiles = item.files === undefined ? [] : item.files;
  if (!Array.isArray(rawFiles)) throw invalidResponse();
  const { files, truncated } = limitDiffFiles(rawFiles);
  return {
    sha: item.sha,
    message: str(commit.message),
    url: str(item.html_url),
    files,
    truncated,
  };
}

export async function fetchDiff(
  repo: Repo,
  sha: string,
): Promise<DiffResponse> {
  const raw = await githubGet(
    `/repos/${repo.owner}/${repo.name}/commits/${sha}`,
  );
  return mapDiff(raw);
}
