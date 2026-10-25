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
import { decideTurn, firstUncovered, isDontKnow } from "@/lib/teacher-rules";
import type { Finding, ResearchTheme, Viewpoint } from "@/lib/types";

export const DEMO_THEME_ID = "demo-theme";

// デモ用のプロジェクトの先生の画像。名前は既定の「先生」のまま。
// イラストは公開しないのでリポジトリに入れていない（.gitignore 済み）。デモをする人が web/public/demo/teacher.jpg に置く。無ければ頭文字を出す
export const DEMO_TEACHER_IMAGE = "/demo/teacher.jpg";

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

export const MAIN_SHA = "b7e2c9d4a1f3e8c6b5d0a9f2e7c4b1d8a3e6f950";
export const README_SHA = "4c8a1e6f3b9d2c7e5a0f8b3d6e1c9a4f7b2d5e83";
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

export const NORMALIZE_SUMMARY =
  "学習が発散する問題に対処するため、データを平均0・分散1に正規化し、評価も正規化したまま行っている";
export const CLIP_SUMMARY =
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

// ---- 先生モード（問い返し型と観点による採点。docs/design.md の「先生の聞き方」「観点による採点」） ----

// デモの観点は、キーワードで採点する（本番は AI が意味で採点する）
type DemoViewpoint = {
  text: string;
  required: boolean;
  keywords: string[]; // どれかが回答に含まれていれば、言えたとみなす
  probe: string; // この観点がまだ言えていないときの問い返し
};

type DemoQuestion = {
  layer: TeacherQuestion["layer"];
  question: string;
  viewpoints: DemoViewpoint[]; // 掘る順
  homework: string; // 届かなかったときの講評：ゼミまでに考えておくこと
  aiDidIt: string; // 「AIがやったので分かりません」への問い返し
  partial?: string; // 一部だけ言えたときの講評（無ければ観点の文から作る）
  answers?: string[]; // ピッチで回答欄にマウスを合わせたときに入れる回答（1回目、2回目…）
};

const NORMALIZE_QUESTION: DemoQuestion = {
  layer: "implementation",
  question:
    "compare.py でデータを正規化していますね。なぜこの対処をしたのですか？",
  viewpoints: [
    {
      text: "元のスケール（座標がおよそ −10〜15）のまま学習すると、損失が nan になり学習が発散した",
      required: false,
      keywords: ["nan", "発散", "不安定", "損失"],
      probe: "正規化する前、学習では何が起きていたのですか？",
    },
    {
      text: "距離を正規化した空間のまま測っていて、README の「元のスケールのまま測る」と違う",
      required: true,
      keywords: [
        "正規化したまま",
        "正規化した空間",
        "元のスケール",
        "元に戻",
        "README",
      ],
      probe:
        "正規化したデータで測った sliced Wasserstein 距離は、README の評価方法どおりですか？",
    },
    {
      text: "距離の値の意味が変わり、前の結果や README の基準とそのまま比べられない",
      required: true,
      keywords: ["意味", "比べられ", "比較でき", "単位", "前の結果"],
      probe:
        "では、その距離の値を、前の結果や README の基準とそのまま比べられますか？",
    },
  ],
  homework:
    "生成した点を元のスケールに戻して距離を測り直し、正規化したままの値と比べておいてください。",
  aiDidIt:
    "AIがやったかどうかは関係ありません。compare.py の normalize の行と、sliced_wasserstein に渡している値を見て、何をしているか説明してください。",
  partial:
    "学習が発散したから正規化した、というところは分かっていますね。\nでも、正規化したまま距離を測ると README の「元のスケールのまま測る」と違い、前の結果とそのまま比べられなくなる、というところはまだ分かっていないようです。",
  // 2回目は一部だけ正しい回答（学習が発散した理由だけで、比べ方が変わることには触れない）
  answers: [
    "AIがやったのでわかりません",
    "正規化しないと損失が nan になって学習が発散したので、平均0・分散1に正規化しました。",
  ],
};

const CLIP_QUESTION: DemoQuestion = {
  layer: "research",
  question:
    "cosine スケジュールの β を 0.02 で抑えています。なぜこの制限が必要だったのですか？",
  viewpoints: [
    {
      text: "cosine の最後のほうで β が 1 近くまで大きくなり、サンプリングで点が飛び散った",
      required: false,
      keywords: ["飛び散", "外れ値", "0.999", "大きくな"],
      probe: "上限を付ける前、サンプリングでは何が起きていたのですか？",
    },
    {
      text: "上限を 0.02 にすると最後のほうのノイズの入り方が変わり、論文の cosine スケジュールとは別物になる",
      required: true,
      keywords: [
        "論文",
        "本来",
        "別物",
        "違うもの",
        "linear に近",
        "linearに近",
      ],
      probe:
        "β の上限を 0.02 にしたスケジュールは、論文の cosine スケジュールと同じものですか？",
    },
    {
      text: "その状態では「cosine は linear より良い（悪い）」と結論できない",
      required: true,
      keywords: ["言えな", "結論", "比較", "公平"],
      probe: "その状態で「cosine は linear より良い（悪い）」と言えますか？",
    },
  ],
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
    viewpoints: [
      {
        text: "生成した点と本物の点には 1 対 1 の対応が無いので、点の集まり（分布）どうしの近さを測る必要がある",
        required: true,
        keywords: ["分布", "近さ", "点群", "集まり"],
        probe:
          "生成した点が本物にどれくらい近いかを、1 つの数で表すには何を比べる必要がありますか？",
      },
      {
        text: "結果は seed でばらつくので、差が偶然でないかを平均と標準偏差で確かめる",
        required: true,
        keywords: ["ばらつ", "標準偏差", "偶然", "再現", "seed"],
        probe: "seed を 3 つ変えて、平均と標準偏差を見るのはなぜですか？",
      },
    ],
    homework:
      "linear と cosine の差が、seed による標準偏差より大きいかを確かめておいてください。",
    aiDidIt:
      "評価の仕方は AI ではなく研究の問いで決まります。この評価で、何を測りたいのですか？",
  };
}

function genericProblemQuestion(problem: Finding): DemoQuestion {
  return {
    layer: "implementation",
    question: `「${problem.summary}」とあります。なぜこの対処をしたのですか？`,
    viewpoints: [
      {
        text: "どんなエラーが、何が原因で起きていたか",
        required: false,
        keywords: ["原因", "エラー"],
        probe: "そのエラーは、何が原因で起きていたのですか？",
      },
      {
        text: "その対処で、データや実験の条件がどう変わったか",
        required: true,
        keywords: ["条件", "影響", "変わ", "結果"],
        probe: "その対処で、データや実験の条件は何か変わりましたか？",
      },
    ],
    homework: `記録では、対処は「${problem.fix ?? "不明"}」です。それで実験の条件が変わらないか確かめてください。`,
    aiDidIt: `AIがやったかどうかは関係ありません。${problem.files[0] ?? "変更されたファイル"} の該当箇所を見て、何をしているか説明してください。`,
  };
}

// 質問の文面から、採点の材料を引けるようにしておく
const asked = new Map<string, DemoQuestion>();

function questionFor(problem: Finding): DemoQuestion {
  if (problem.summary === NORMALIZE_SUMMARY) return NORMALIZE_QUESTION;
  if (problem.summary === CLIP_SUMMARY) return CLIP_QUESTION;
  return genericProblemQuestion(problem);
}

function toViewpoints(q: DemoQuestion): Viewpoint[] {
  return q.viewpoints.map((v, i) => ({
    id: `v${i + 1}`,
    text: v.text,
    required: v.required,
  }));
}

export function demoTeacherQuestions(
  req: TeacherQuestionsRequest,
): TeacherQuestion[] {
  // デモ用のプロジェクトで問題を1つも保存していないときは、題材の判定の隠れた問題を保存したものとして聞く
  // （プロジェクト画面の「先生モード」から入っても、ピッチと同じ正規化の質問から始まるように）
  const problems =
    req.problems.length === 0 && req.theme.name === demoTheme.name
      ? demoReviewFindings(MAIN_SHA).filter((f) => f.type === "hidden_problem")
      : req.problems;
  const list: { q: DemoQuestion; findingId?: string }[] = problems
    .slice(0, 2)
    .map((p) => ({ q: questionFor(p), findingId: p.id }));
  list.push({ q: evaluationQuestion(req.theme.evaluation) });

  // ピッチで短く見せるため、質問は2つまで（保存した問題を先に聞く）
  return list.slice(0, 2).map(({ q, findingId }) => {
    asked.set(q.question, q);
    return {
      layer: q.layer,
      question: q.question,
      ...(findingId ? { findingId } : {}),
      viewpoints: toViewpoints(q),
    };
  });
}

function mentions(answer: string, keywords: string[]): boolean {
  const a = answer.toLowerCase();
  return keywords.some((k) => a.includes(k.toLowerCase()));
}

function isAiDidIt(answer: string): boolean {
  return /AI|ＡＩ|Claude|クロード/i.test(answer) && isDontKnow(answer);
}

export function demoTeacherTurn(req: TeacherTurnRequest): TeacherTurnResponse {
  const q = asked.get(req.question.question);
  const viewpoints = req.question.viewpoints;
  const last = req.turns[req.turns.length - 1]?.text.trim() ?? "";

  // 観点ごとのキーワードで採点し、言えた観点を積み上げる
  const covered = viewpoints
    .map((v) => v.id)
    .filter((id, i) => {
      if (req.covered.includes(id)) return true;
      const demo = q?.viewpoints[i];
      return !!demo && !isDontKnow(last) && mentions(last, demo.keywords);
    });

  const { done, understood } = decideTurn(viewpoints, covered, req.turns);
  // ピッチで短く見せるため、必須でない観点だけが言えた（必須はまだ1つも言えていない）ときは、ここで一部正解の講評をして終える
  const requiredSaid = viewpoints.some((v) => v.required && covered.includes(v.id));
  if (!done && covered.length > req.covered.length && !requiredSaid) {
    const said = viewpoints.filter((v) => covered.includes(v.id));
    const missing = viewpoints.filter(
      (v) => v.required && !covered.includes(v.id),
    );
    const partial =
      q?.partial ??
      `「${said.map((v) => v.text).join("」「")}」は言えていますね。\nでも、「${missing.map((v) => v.text).join("」「")}」は、まだ分かっていないようです。`;
    return {
      done: true,
      understood: false,
      covered,
      message: `${partial}\nゼミまでに：${q?.homework ?? "この変更が研究の結果にどう影響するか整理してください。"}`,
    };
  }
  if (done && understood) {
    return {
      done,
      understood,
      covered,
      message:
        "そこまで自分の言葉で言えれば十分です。ゼミでも同じ順序で説明してください。",
    };
  }
  if (done) {
    const missing = viewpoints.filter(
      (v) => v.required && !covered.includes(v.id),
    );
    return {
      done,
      understood,
      covered,
      message: `「${missing.map((v) => v.text).join("」「")}」まで届いていません。\nゼミまでに：${q?.homework ?? "この変更が研究の結果にどう影響するか整理してください。"}`,
    };
  }

  const next = firstUncovered(viewpoints, covered);
  const probe =
    (next && q?.viewpoints[viewpoints.indexOf(next)]?.probe) ??
    "それは、あなたの研究の問いにどう関係しますか？";
  let message: string;
  if (q && isAiDidIt(last)) message = q.aiDidIt;
  else if (isDontKnow(last)) message = probe;
  else if (covered.length === req.covered.length)
    message = `それでは理由になっていません。${probe}`;
  else message = probe;
  return { done, understood, covered, message };
}

// ピッチで、回答欄にマウスを合わせたときに入れる回答。その質問で何回目の回答か（0 から）で決まる。無ければ undefined
export function demoAnswerSuggestion(
  question: string,
  answered: number,
): string | undefined {
  return asked.get(question)?.answers?.[answered];
}

// 一問一答の API（POST /api/teacher/feedback）のデモ。今の先生モードの画面は使っていない
export function demoTeacherFeedback(
  req: TeacherFeedbackRequest,
): TeacherFeedbackResponse {
  const q = asked.get(req.question.question);
  const answer = req.answer.trim();
  const required = q?.viewpoints.filter((v) => v.required) ?? [];
  const understood =
    !isDontKnow(answer) &&
    required.length > 0 &&
    required.every((v) => mentions(answer, v.keywords));
  return {
    understood,
    feedback: understood
      ? "要点は押さえられています。"
      : "核心まで届いていません。",
  };
}
