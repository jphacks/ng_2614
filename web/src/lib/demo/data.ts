// デモモード（F-12）で使うデモデータ。docs/design.md の「5. デモシナリオ」の題材。
// 本物の API と同じ型で返すので、画面はデモかどうかを気にせず動く。

import type {
  CommitSummary,
  DiffResponse,
  TeacherFeedbackRequest,
  TeacherFeedbackResponse,
  TeacherQuestion,
  TeacherQuestionsRequest,
  TeacherTurnRequest,
  TeacherTurnResponse,
} from "@/lib/api-types";
import { countStudentTurns, isDontKnow, mustFinish } from "@/lib/teacher-rules";
import type { Finding, ResearchTheme } from "@/lib/types";

export const DEMO_THEME_ID = "demo-theme";

export const demoTheme: Omit<ResearchTheme, "updatedAt"> = {
  id: DEMO_THEME_ID,
  name: "【デモ】DDPM のノイズスケジュール：cosine は linear より生成の質が上がるか",
  repo: "demo-lab/ddpm-noise-schedule",
  question:
    "拡散モデル（DDPM）で、ノイズスケジュールを linear から cosine に変えると、2次元トイデータ（swiss roll）の生成の質が上がるかを明らかにする。",
  method:
    "提案側は cosine スケジュール（Nichol & Dhariwal, 2021）、ベースラインは linear スケジュール（β を 1e-4 から 0.02 まで線形）。データ・モデル・拡散のステップ数 T・学習の設定・サンプリングは両者でそろえ、変えるのはスケジュールだけ。",
  evaluation:
    "生成した 2,000 点と本物 2,000 点の sliced Wasserstein 距離（小さいほど良い）。データは元のスケールのまま測る。seed を 3 つ変えて平均と標準偏差で比べる。",
};

// ---- コミットと差分 ----

const MAIN_SHA = "b7e2c9d4a1f3e8c6b5d0a9f2e7c4b1d8a3e6f950";
const README_SHA = "4c8a1e6f3b9d2c7e5a0f8b3d6e1c9a4f7b2d5e83";
const INIT_SHA = "e6c5e08d2a7f4b1c9e3d8a5f0b6c2e9d4a1f7b36";

const DEMO_REPO_URL = "https://github.com/demo-lab/ddpm-noise-schedule";

export const demoCommits: CommitSummary[] = [
  {
    sha: MAIN_SHA,
    message:
      "cosine スケジュールを追加して linear と比較\n\nlinear と cosine を seed 3 つで比べる compare.py を追加。\n学習が発散する問題と、サンプルが飛び散る問題を修正。",
    author: "claude-code",
    date: "2026-10-24T13:42:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${MAIN_SHA}`,
  },
  {
    sha: README_SHA,
    message: "README に評価方法を追加",
    author: "researcher",
    date: "2026-10-24T11:05:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${README_SHA}`,
  },
  {
    sha: INIT_SHA,
    message: "DDPM のベースライン（linear スケジュール）を追加",
    author: "researcher",
    date: "2026-10-24T10:30:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${INIT_SHA}`,
  },
];

const DDPM_PATCH = `@@ -1,12 +1,25 @@
 """2 次元データ用の小さな DDPM。"""
 
+import math
+
 import torch
 import torch.nn as nn
 
 T = 200  # 拡散のステップ数
 
 
+def cosine_betas(T: int, s: float = 0.008) -> torch.Tensor:
+    steps = torch.arange(T + 1, dtype=torch.float64)
+    f = torch.cos((steps / T + s) / (1 + s) * math.pi / 2) ** 2
+    alphas_bar = f / f[0]
+    betas = 1 - alphas_bar[1:] / alphas_bar[:-1]
+    # 最後のほうで β が大きくなりすぎ、サンプルが飛び散るため 0.02 で抑える
+    return betas.clamp(max=0.02).float()
+
+
 def get_betas(name: str, T: int = T) -> torch.Tensor:
     if name == "linear":
         return torch.linspace(1e-4, 0.02, T)
+    if name == "cosine":
+        return cosine_betas(T)
     raise ValueError(f"unknown schedule: {name}")
`;

const COMPARE_PATCH = `@@ -0,0 +1,44 @@
+import argparse
+
+import matplotlib.pyplot as plt
+import numpy as np
+
+from data import make_swiss_roll
+from ddpm import get_betas, sample, train
+from metrics import sliced_wasserstein
+
+SEEDS = [0, 1, 2]
+
+
+def normalize(x, mean, std):
+    return (x - mean) / std
+
+
+def main(steps: int):
+    data = make_swiss_roll(2000, seed=0)
+    ref = make_swiss_roll(2000, seed=100)
+    # 元のスケールのままだと学習中に損失が nan になるため、平均0・分散1に正規化する
+    mean, std = data.mean(axis=0), data.std(axis=0)
+    data_n = normalize(data, mean, std)
+    ref_n = normalize(ref, mean, std)
+
+    fig, axes = plt.subplots(1, 2, figsize=(8, 4))
+    for ax, name in zip(axes, ["linear", "cosine"]):
+        betas = get_betas(name)
+        scores = []
+        for seed in SEEDS:
+            model = train(betas, data_n, steps=steps, seed=seed)
+            samples = sample(model, betas, n=2000, seed=seed)
+            scores.append(sliced_wasserstein(samples, ref_n))
+        print(f"{name}: SW = {np.mean(scores):.3f} ± {np.std(scores):.3f}")
+        ax.scatter(samples[:, 0], samples[:, 1], s=2)
+        ax.set_title(name)
+    fig.savefig("samples.png", dpi=150)
+
+
+if __name__ == "__main__":
+    parser = argparse.ArgumentParser()
+    # 試しに速く回すときは --quick（学習ステップを 1000 に減らす）
+    parser.add_argument("--quick", action="store_true")
+    args = parser.parse_args()
+    main(steps=1000 if args.quick else 3000)
`;

const REQUIREMENTS_PATCH = `@@ -1,2 +1,3 @@
 numpy
 torch
+matplotlib
`;

const README_PATCH = `@@ -3,2 +3,8 @@
 拡散モデル（DDPM）で、ノイズスケジュールを linear から cosine に変えると、
 生成の質が上がるかを、2次元のトイデータ（swiss roll）で調べる。
+
+## 評価
+
+- 生成した 2,000 点と、本物の 2,000 点の sliced Wasserstein 距離（metrics.py、小さいほど良い）
+- データは元のスケールのまま測る
+- seed を 3 つ変えて、平均と標準偏差で比べる
`;

const demoDiffs: Record<string, DiffResponse> = {
  [MAIN_SHA]: {
    sha: MAIN_SHA,
    message: demoCommits[0].message,
    url: demoCommits[0].url,
    truncated: false,
    files: [
      {
        filename: "ddpm.py",
        status: "modified",
        additions: 13,
        deletions: 0,
        patch: DDPM_PATCH,
      },
      {
        filename: "compare.py",
        status: "added",
        additions: 44,
        deletions: 0,
        patch: COMPARE_PATCH,
      },
      {
        filename: "requirements.txt",
        status: "modified",
        additions: 1,
        deletions: 0,
        patch: REQUIREMENTS_PATCH,
      },
    ],
  },
  [README_SHA]: {
    sha: README_SHA,
    message: demoCommits[1].message,
    url: demoCommits[1].url,
    truncated: false,
    files: [
      {
        filename: "README.md",
        status: "modified",
        additions: 6,
        deletions: 0,
        patch: README_PATCH,
      },
    ],
  },
  [INIT_SHA]: {
    sha: INIT_SHA,
    message: demoCommits[2].message,
    url: demoCommits[2].url,
    truncated: false,
    files: [
      {
        filename: "README.md",
        status: "added",
        additions: 4,
        deletions: 0,
        patch:
          "@@ -0,0 +1,4 @@\n+# DDPM のノイズスケジュールの比較（2次元トイデータ）\n+\n+拡散モデル（DDPM）で、ノイズスケジュールを linear から cosine に変えると、\n+生成の質が上がるかを、2次元のトイデータ（swiss roll）で調べる。\n",
      },
    ],
  },
};

export function demoDiff(sha: string): DiffResponse | undefined {
  return demoDiffs[sha];
}

// ---- 判定 ----

type FindingTemplate = Omit<Finding, "id" | "saved">;

const NORMALIZE_SUMMARY =
  "学習が発散する問題に対処するため、データを平均0・分散1に正規化し、評価も正規化したまま行っている";
const CLIP_SUMMARY =
  "サンプルが飛び散る問題に対処するため、cosine スケジュールの β の上限を 0.02 に抑えている";

const demoFindings: Record<string, FindingTemplate[]> = {
  [MAIN_SHA]: [
    {
      type: "on_purpose",
      summary:
        "cosine スケジュールを get_betas に追加し、linear と cosine を同じデータ・モデル・seed 3 つで学習・サンプリングして、sliced Wasserstein 距離の平均と標準偏差を出す compare.py を追加。研究の目的・作業の目的どおり",
      files: ["ddpm.py", "compare.py"],
    },
    {
      type: "hidden_problem",
      summary: NORMALIZE_SUMMARY,
      files: ["compare.py"],
      error:
        "元のスケール（座標がおよそ −10〜15）のデータのまま学習すると、損失が nan になり学習が発散した",
      errorIsInferred: false,
      fix: "学習データと本物のデータを、学習データの平均と標準偏差で正規化してから学習し、生成した点も正規化した空間のまま sliced Wasserstein 距離を測るようにした",
      researchImpact: {
        exists: true,
        description:
          "研究の評価は「データは元のスケールのまま測る」と決めているが、距離が正規化した空間で測られている。値の大きさの意味が変わるので、前の結果や README の基準とそのまま比べられない。linear と cosine は同じ処理なので、2 つの比較の公平さは保たれている。生成した点を元のスケールに戻して測り直す必要がある",
      },
    },
    {
      type: "hidden_problem",
      summary: CLIP_SUMMARY,
      files: ["ddpm.py"],
      error:
        "cosine スケジュールの最後のほうで β が 0.999 近くまで大きくなり、サンプリングで点が大きく飛び散った（外れ値が出た）",
      errorIsInferred: true,
      fix: "cosine_betas の中で betas.clamp(max=0.02) を入れ、β の上限を 0.02 にした（論文の cosine は上限 0.999）",
      researchImpact: {
        exists: true,
        description:
          "上限を 0.02 にすると、最後のほうのノイズの入り方が linear に近づき、比べているのが論文の cosine スケジュールではなくなる。「cosine は linear より良い（悪い）」という結論を、本来の cosine について言えない。上限を変えたことと、その理由を明記するか、論文どおりの上限で起きる問題を別の方法で解く必要がある",
      },
    },
    {
      type: "extra_addition",
      summary:
        "頼んでいない生成結果の散布図（samples.png）の保存と、学習ステップを 1000 に減らして速く回す --quick オプションの追加。依存ライブラリにも matplotlib が増えた",
      files: ["compare.py", "requirements.txt"],
    },
  ],
  [README_SHA]: [
    {
      type: "on_purpose",
      summary:
        "README に評価の方法（sliced Wasserstein 距離、元のスケール、seed 3 つ）を追加している",
      files: ["README.md"],
    },
  ],
  [INIT_SHA]: [
    {
      type: "on_purpose",
      summary: "リポジトリの初期化と README の作成",
      files: ["README.md"],
    },
  ],
};

export function demoReviewFindings(sha: string): Finding[] {
  const templates = demoFindings[sha] ?? [
    {
      type: "on_purpose" as const,
      summary: "作業の目的どおりの変更",
      files: demoDiffs[sha]?.files.map((f) => f.filename) ?? [],
    },
  ];
  return templates.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
    saved: false,
  }));
}

// ---- 先生モード（問い返し型。docs/design.md の「先生の聞き方」） ----

// 質問ごとに、問い返しの順番（掘る順）と、核心に届いたとみなすキーワードを持つ
type DemoQuestion = {
  layer: TeacherQuestion["layer"];
  question: string;
  probes: string[]; // 学生の答えが届かなかったときの問い返し。1回目、2回目…の順
  goal: string[]; // 回答に含まれていれば、核心（研究への影響）に届いたとみなす
  missing: string; // 届かなかったときの講評：何が抜けていたか
  homework: string; // 届かなかったときの講評：ゼミまでに考えておくこと
  aiDidIt: string; // 「AIがやったので分かりません」への問い返し
};

const NORMALIZE_QUESTION: DemoQuestion = {
  layer: "implementation",
  question:
    "compare.py でデータを正規化していますね。なぜこの対処をしたのですか？",
  probes: [
    "正規化する前、学習では何が起きていたのですか？",
    "正規化したデータで測った sliced Wasserstein 距離は、元のスケールで測った値と同じ意味ですか？",
    "では、README の評価方法と比べて、この結果をそのまま論文に書けますか？",
  ],
  goal: ["スケール", "元の", "単位", "意味", "戻", "README"],
  missing:
    "距離が正規化した空間で測られていて、README の「元のスケールのまま測る」と違う点まで届いていません。",
  homework:
    "生成した点を元のスケールに戻して距離を測り直し、正規化したままの値と比べておいてください。",
  aiDidIt:
    "AIがやったかどうかは関係ありません。compare.py の normalize の行と、sliced_wasserstein に渡している値を見て、何をしているか説明してください。",
};

const CLIP_QUESTION: DemoQuestion = {
  layer: "research",
  question:
    "cosine スケジュールの β を 0.02 で抑えています。なぜこの制限が必要だったのですか？",
  probes: [
    "β の上限を 0.02 にすると、cosine の最後のほうのノイズの入り方はどうなりますか？",
    "それは、論文の cosine スケジュールと同じものですか？",
    "その状態で「cosine は linear より良い（悪い）」と言えますか？",
  ],
  goal: [
    "論文",
    "本来",
    "別物",
    "違う",
    "linear に近",
    "linearに近",
    "提案手法",
  ],
  missing:
    "上限を付けたことで、比べているのが本来の cosine スケジュールではなくなっている点まで届いていません。",
  homework:
    "上限 0.999（論文の値）と 0.02 の両方で ᾱ_t のグラフを描き、どこが違うか説明できるようにしてください。",
  aiDidIt:
    "AIがやったかどうかは関係ありません。ddpm.py の cosine_betas の clamp の行を見て、何をしているか説明してください。",
};

function evaluationQuestion(evaluation: string): DemoQuestion {
  const short =
    evaluation.length > 40 ? `${evaluation.slice(0, 40)}…` : evaluation;
  return {
    layer: "research",
    question: `評価を「${short}」としています。なぜこの評価の仕方を選んだのですか？`,
    probes: [
      "生成した点が本物にどれくらい近いかを、1 つの数で表すには何を比べる必要がありますか？",
      "seed を 3 つ変えて、平均と標準偏差を見るのはなぜですか？",
      "では、linear と cosine の差が標準偏差より小さいとき、どちらが良いと言えますか？",
    ],
    goal: ["分布", "ばらつき", "標準偏差", "偶然", "再現"],
    missing:
      "分布どうしの近さを測る理由と、seed を変えて差の大きさを確かめる理由まで届いていません。",
    homework:
      "linear と cosine の差が、seed による標準偏差より大きいかを確かめておいてください。",
    aiDidIt:
      "評価の仕方を決めるのはあなたです。研究の問いに照らして、何を測りたいのか説明してください。",
  };
}

function genericProblemQuestion(problem: Finding): DemoQuestion {
  return {
    layer: "implementation",
    question: `「${problem.summary}」とあります。なぜこの対処をしたのですか？`,
    probes: [
      "そのエラーは、何が原因で起きていたのですか？",
      "その対処で、データや実験の条件は何か変わりましたか？",
      "それは、あなたの研究の問いに答えるうえで問題になりますか？",
    ],
    goal: ["影響", "条件", "比較", "結果"],
    missing: "対処が研究の結果にどう影響するかまで届いていません。",
    homework: `記録では、対処は「${problem.fix ?? "不明"}」です。それで実験の条件が変わらないか確かめてください。`,
    aiDidIt: `AIがやったかどうかは関係ありません。${problem.files[0] ?? "変更されたファイル"} の該当箇所を見て、何をしているか説明してください。`,
  };
}

// 質問の文面から、問い返しの材料を引けるようにしておく
const asked = new Map<string, DemoQuestion>();

function questionFor(problem: Finding): DemoQuestion {
  if (problem.summary === NORMALIZE_SUMMARY) return NORMALIZE_QUESTION;
  if (problem.summary === CLIP_SUMMARY) return CLIP_QUESTION;
  return genericProblemQuestion(problem);
}

export function demoTeacherQuestions(
  req: TeacherQuestionsRequest,
): TeacherQuestion[] {
  const list: { q: DemoQuestion; findingId?: string }[] = req.problems
    .slice(0, 2)
    .map((p) => ({ q: questionFor(p), findingId: p.id }));
  list.push({ q: evaluationQuestion(req.theme.evaluation) });

  return list.map(({ q, findingId }) => {
    asked.set(q.question, q);
    return {
      layer: q.layer,
      question: q.question,
      ...(findingId ? { findingId } : {}),
    };
  });
}

function reachedGoal(q: DemoQuestion | undefined, answer: string): boolean {
  if (!q) return answer.length >= 30;
  return q.goal.some((k) => answer.toLowerCase().includes(k.toLowerCase()));
}

function isAiDidIt(answer: string): boolean {
  return /AI|ＡＩ|Claude|クロード/i.test(answer) && isDontKnow(answer);
}

export function demoTeacherTurn(req: TeacherTurnRequest): TeacherTurnResponse {
  const q = asked.get(req.question.question);
  const last = req.turns[req.turns.length - 1]?.text.trim() ?? "";
  const answered = countStudentTurns(req.turns);

  if (!isDontKnow(last) && reachedGoal(q, last)) {
    return {
      done: true,
      understood: true,
      message:
        "そこまで自分の言葉で言えれば十分です。ゼミでも同じ順序で説明してください。",
    };
  }

  if (mustFinish(req.turns)) {
    return {
      done: true,
      understood: false,
      message: q
        ? `${q.missing}\nゼミまでに：${q.homework}`
        : "核心まで届いていません。ゼミまでに、この変更が研究の結果にどう影響するか整理してください。",
    };
  }

  let message: string;
  if (q && isAiDidIt(last)) {
    message = q.aiDidIt;
  } else {
    const probe =
      q?.probes[Math.min(answered - 1, q.probes.length - 1)] ??
      "それは、あなたの研究の問いにどう関係しますか？";
    if (isDontKnow(last)) message = `では、ここから考えてください。${probe}`;
    else if (last.length < 15)
      message = `それでは理由になっていません。${probe}`;
    else message = probe;
  }
  return { done: false, understood: false, message };
}

// 一問一答の API（POST /api/teacher/feedback）のデモ。今の先生モードの画面は使っていない
export function demoTeacherFeedback(
  req: TeacherFeedbackRequest,
): TeacherFeedbackResponse {
  const q = asked.get(req.question.question);
  const answer = req.answer.trim();
  const understood = !isDontKnow(answer) && reachedGoal(q, answer);
  return {
    understood,
    feedback: understood
      ? "要点は押さえられています。"
      : (q?.missing ?? "核心まで届いていません。"),
  };
}
