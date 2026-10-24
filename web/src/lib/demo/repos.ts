// デモモード（F-12）で、新しいプロジェクト（S-6）のリポジトリの一覧に出すもの
import type { RepoSummary } from "@/lib/api-types";
import { demoTheme } from "./data";

export const demoRepos: RepoSummary[] = [
  {
    fullName: demoTheme.repo,
    private: false,
    description: "デモ用の研究リポジトリ",
    language: "Python",
    pushedAt: "2026-10-24T13:42:00+09:00",
    url: `https://github.com/${demoTheme.repo}`,
  },
  {
    fullName: "demo-lab/seminar-slides",
    private: true,
    description: "ゼミの発表資料",
    language: "TeX",
    pushedAt: "2026-10-20T18:00:00+09:00",
    url: "https://github.com/demo-lab/seminar-slides",
  },
  {
    fullName: "demo-lab/dotfiles",
    private: false,
    description: "",
    language: "Shell",
    pushedAt: "2026-09-30T09:00:00+09:00",
    url: "https://github.com/demo-lab/dotfiles",
  },
];
