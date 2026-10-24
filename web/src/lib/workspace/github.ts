// research-workspace を GitHub から読む（F-15）。サーバー側だけで使う。
// GITHUB_TOKEN は lib/github.ts の githubGet が付ける。値はログにもエラーにも出さない。

import { githubGet, GithubApiError, parseSha, type Repo } from "@/lib/github";
import type { WorkspaceFile } from "./parse";

// 一度に読むファイルの上限（parse.ts の selectWorkspacePaths の順で先頭から）
export const MAX_WORKSPACE_FILES = 200;
// 1ファイルの上限（超えた分は切る）
export const MAX_FILE_CHARS = 60_000;

// ファイルを同時に読む本数
const FETCH_CONCURRENCY = 8;

function invalidResponse(): GithubApiError {
  return new GithubApiError("GitHub API の応答の形式が想定と違います", 502);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function repoPath(repo: Repo): string {
  return `/repos/${repo.owner}/${repo.name}`;
}

// ファイルのパスを URL に入れる形にする（"/" は区切りとして残し、各区間をエスケープする）
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// 既定のブランチの最新コミットの SHA
export async function fetchWorkspaceHead(repo: Repo): Promise<string> {
  const raw = await githubGet(`${repoPath(repo)}/commits?per_page=1`);
  if (!Array.isArray(raw)) throw invalidResponse();
  if (raw.length === 0) {
    throw new GithubApiError(
      "ワークスペースのリポジトリにコミットがありません",
      404,
    );
  }
  const sha = asRecord(raw[0])?.sha;
  if (typeof sha !== "string" || sha === "") throw invalidResponse();
  return sha;
}

// そのコミットのツリーの、ファイルのパスの一覧（GET /repos/{o}/{n}/git/trees/{sha}?recursive=1）。
// ツリーが大きすぎて GitHub が途中で切った（truncated）ときも、読めた分を返す
export async function listWorkspacePaths(repo: Repo, sha: string): Promise<string[]> {
  const raw = await githubGet(
    `${repoPath(repo)}/git/trees/${parseSha(sha)}?recursive=1`,
  );
  const tree = asRecord(raw)?.tree;
  if (!Array.isArray(tree)) throw invalidResponse();
  const paths: string[] = [];
  for (const entry of tree) {
    const item = asRecord(entry);
    if (item?.type === "blob" && typeof item.path === "string") {
      paths.push(item.path);
    }
  }
  return paths;
}

// 1つのファイルを読む。ファイルでない・大きすぎて中身が返らない・壊れているときは undefined
async function fetchOneFile(
  repo: Repo,
  ref: string,
  path: string,
): Promise<WorkspaceFile | undefined> {
  const raw = await githubGet(
    `${repoPath(repo)}/contents/${encodePath(path)}?ref=${ref}`,
  );
  const item = asRecord(raw);
  // 1MB を超えるファイルは encoding が "none"、content が空で返る。ディレクトリは配列で返る
  if (!item || item.type !== "file") return undefined;
  if (item.encoding !== "base64" || typeof item.content !== "string") {
    return undefined;
  }
  const text = Buffer.from(item.content, "base64").toString("utf8");
  return { path, text: text.slice(0, MAX_FILE_CHARS) };
}

// ファイルの中身を読む（8本ずつ並列）。読めなかったファイルは飛ばす。返す順は paths の順。
// 全部のファイルに共通する失敗（トークンが無効・レート制限）は、飛ばさずに投げる
export async function fetchWorkspaceFiles(
  repo: Repo,
  sha: string,
  paths: string[],
): Promise<WorkspaceFile[]> {
  const ref = parseSha(sha);
  const results: (WorkspaceFile | undefined)[] = new Array(paths.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < paths.length) {
      const index = next++;
      try {
        results[index] = await fetchOneFile(repo, ref, paths[index]);
      } catch (e) {
        if (e instanceof GithubApiError && (e.status === 401 || e.status === 429)) {
          throw e;
        }
        // それ以外（消えた・読めなかった）は、そのファイルだけ飛ばす
      }
    }
  }

  const workerCount = Math.min(FETCH_CONCURRENCY, paths.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter((f): f is WorkspaceFile => f !== undefined);
}

// base から head までに変わったファイルのパス（GET /repos/{o}/{n}/compare/{base}...{head}）。
// 消えたファイルは含めない
export async function changedPathsSince(
  repo: Repo,
  base: string,
  head: string,
): Promise<string[]> {
  const raw = await githubGet(
    `${repoPath(repo)}/compare/${parseSha(base)}...${parseSha(head)}`,
  );
  const files = asRecord(raw)?.files;
  if (files === undefined) return [];
  if (!Array.isArray(files)) throw invalidResponse();
  const paths: string[] = [];
  for (const entry of files) {
    const item = asRecord(entry);
    if (!item || typeof item.filename !== "string") throw invalidResponse();
    if (item.status !== "removed") paths.push(item.filename);
  }
  return paths;
}
