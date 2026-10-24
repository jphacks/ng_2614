// デモモード（F-12）で使うデモデータ。docs/design.md の「5. デモシナリオ」の題材。
// 本物の API と同じ型で返すので、画面はデモかどうかを気にせず動く。

import type {
  CommitSummary,
  DiffResponse,
  TeacherFeedbackRequest,
  TeacherFeedbackResponse,
  TeacherQuestion,
  TeacherQuestionsRequest,
} from "@/lib/api-types";
import type { Finding, ResearchTheme } from "@/lib/types";

export const DEMO_THEME_ID = "demo-theme";

export const demoTheme: Omit<ResearchTheme, "updatedAt"> = {
  id: DEMO_THEME_ID,
  name: "【デモ】健診データの疾患分類：勾配ブースティングは従来手法を上回るか",
  repo: "demo-lab/health-checkup-classification",
  question:
    "健診データ（血液検査・問診の表形式データ）から生活習慣病の有無を分類するとき、勾配ブースティング（LightGBM）はロジスティック回帰より精度が上がるかを明らかにする。",
  method:
    "提案側は LightGBM、ベースラインはロジスティック回帰。前処理と特徴量は両者で揃え、同じデータ分割で比較する。",
  evaluation:
    "評価指標はマクロ F1。陽性が少ない不均衡データなので正解率は使わない。5分割の層化交差検証の平均と標準偏差で比較する。",
};

// ---- コミットと差分 ----

const MAIN_SHA = "a3f9c2e7b1d84f0c9e6a5b2d7c1f8e3a4b6d9c20";
const README_SHA = "5d1e8b3c9a7f2e4d6b0c8a1f3e5d7b9c2a4e6f81";
const INIT_SHA = "9c7b5a3e1f2d4c6b8a0e9d7c5b3a1f2e4d6c8b07";

const DEMO_REPO_URL = "https://github.com/demo-lab/health-checkup-classification";

export const demoCommits: CommitSummary[] = [
  {
    sha: MAIN_SHA,
    message:
      "学習・評価スクリプトを追加\n\nLightGBM とロジスティック回帰を 5分割交差検証で比較する train.py を追加。\n学習時のエラーを修正。",
    author: "claude-code",
    date: "2026-10-24T13:42:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${MAIN_SHA}`,
  },
  {
    sha: README_SHA,
    message: "README にデータセットの説明を追加",
    author: "researcher",
    date: "2026-10-24T11:05:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${README_SHA}`,
  },
  {
    sha: INIT_SHA,
    message: "Initial commit",
    author: "researcher",
    date: "2026-10-24T10:30:00+09:00",
    url: `${DEMO_REPO_URL}/commit/${INIT_SHA}`,
  },
];

const TRAIN_PATCH = `@@ -0,0 +1,62 @@
+import numpy as np
+import optuna
+import pandas as pd
+from lightgbm import LGBMClassifier
+from sklearn.linear_model import LogisticRegression
+from sklearn.metrics import f1_score
+from sklearn.model_selection import StratifiedKFold
+from sklearn.preprocessing import StandardScaler
+
+SEED = 42
+
+
+def load_data(path="data/checkup.csv"):
+    df = pd.read_csv(path)
+    # 学習時に "Input contains NaN" で落ちるため、欠損のある行を除外する
+    df = df.dropna()
+    X = df.drop(columns=["label"])
+    y = df["label"]
+    return X, y
+
+
+def make_baseline():
+    # 陽性が少なく、すべて陰性と予測してしまうため重みを付ける
+    return LogisticRegression(max_iter=1000, class_weight="balanced")
+
+
+def tune_lgbm(X, y):
+    def objective(trial):
+        params = {
+            "num_leaves": trial.suggest_int("num_leaves", 8, 128),
+            "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
+            "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
+        }
+        return cross_validate(LGBMClassifier(**params, random_state=SEED), X, y).mean()
+
+    study = optuna.create_study(direction="maximize")
+    study.optimize(objective, n_trials=50)
+    return LGBMClassifier(**study.best_params, random_state=SEED)
+
+
+def cross_validate(model, X, y):
+    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
+    scores = []
+    for train_idx, test_idx in skf.split(X, y):
+        scaler = StandardScaler().fit(X.iloc[train_idx])
+        X_train = scaler.transform(X.iloc[train_idx])
+        X_test = scaler.transform(X.iloc[test_idx])
+        model.fit(X_train, y.iloc[train_idx])
+        pred = model.predict(X_test)
+        scores.append(f1_score(y.iloc[test_idx], pred, average="macro"))
+    return np.array(scores)
+
+
+if __name__ == "__main__":
+    X, y = load_data()
+    print(f"samples: {len(X)}")
+    for name, model in [("logreg", make_baseline()), ("lgbm", tune_lgbm(X, y))]:
+        scores = cross_validate(model, X, y)
+        print(f"{name}: macro F1 = {scores.mean():.3f} ± {scores.std():.3f}")
`;

const REQUIREMENTS_PATCH = `@@ -1,3 +1,5 @@
 pandas
 scikit-learn
 lightgbm
+numpy
+optuna
`;

const README_PATCH = `@@ -1,3 +1,9 @@
 # health-checkup-classification

 健診データから生活習慣病の有無を分類する研究のコード。
+
+## データセット
+
+- data/checkup.csv：匿名化済みの健診データ（約 3,000 件、陽性は約 12%）
+- 列：年齢、BMI、血圧、HbA1c、LDL コレステロールなど 18 項目と、ラベル（label）
+- 一部の検査項目には欠損がある（未受診の項目）
`;

const demoDiffs: Record<string, DiffResponse> = {
  [MAIN_SHA]: {
    sha: MAIN_SHA,
    message: demoCommits[0].message,
    url: demoCommits[0].url,
    truncated: false,
    files: [
      {
        filename: "train.py",
        status: "added",
        additions: 62,
        deletions: 0,
        patch: TRAIN_PATCH,
      },
      {
        filename: "requirements.txt",
        status: "modified",
        additions: 2,
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
        additions: 3,
        deletions: 0,
        patch:
          "@@ -0,0 +1,3 @@\n+# health-checkup-classification\n+\n+健診データから生活習慣病の有無を分類する研究のコード。\n",
      },
    ],
  },
};

export function demoDiff(sha: string): DiffResponse | undefined {
  return demoDiffs[sha];
}

// ---- 判定 ----

type FindingTemplate = Omit<Finding, "id" | "saved">;

const DROPNA_SUMMARY =
  "学習時の欠損値エラーに対処するため、欠損のある行をすべて除外している";
const CLASS_WEIGHT_SUMMARY =
  "ベースラインがすべて陰性と予測してしまう問題に対処するため、ロジスティック回帰にだけクラスの重み付けを入れている";

const demoFindings: Record<string, FindingTemplate[]> = {
  [MAIN_SHA]: [
    {
      type: "on_purpose",
      summary:
        "データを読み込み、LightGBM とロジスティック回帰を層化5分割交差検証のマクロ F1 で比較する処理。研究の目的・作業の目的どおり",
      files: ["train.py"],
    },
    {
      type: "hidden_problem",
      summary: DROPNA_SUMMARY,
      files: ["train.py"],
      error:
        "ValueError: Input X contains NaN.（ロジスティック回帰と StandardScaler は欠損値を扱えないため、学習時に落ちた）",
      errorIsInferred: true,
      fix: "読み込み直後に df.dropna() で、欠損が1つでもある行を除外した",
      researchImpact: {
        exists: true,
        description:
          "データ件数が減り、比較に使うデータセットそのものが変わる。欠損は未受診の項目に多いため、除外された行に偏りがあると陽性率や結果も変わりうる。論文には除外の基準と件数を書く必要がある。LightGBM は欠損値をそのまま扱えるので、除外しない比較も検討の余地がある",
      },
    },
    {
      type: "hidden_problem",
      summary: CLASS_WEIGHT_SUMMARY,
      files: ["train.py"],
      error:
        "陽性が約12%しかないため、ロジスティック回帰がすべて陰性と予測し、陽性クラスの F1 が 0 になっていた",
      errorIsInferred: true,
      fix: 'LogisticRegression に class_weight="balanced" を指定した',
      researchImpact: {
        exists: true,
        description:
          "ベースラインにだけ不均衡への対処が入り、LightGBM には入っていない。比較条件が揃っていないので、「手法の差」と「不均衡への対処の差」が区別できない",
      },
    },
    {
      type: "extra_addition",
      summary:
        "頼んでいない Optuna によるハイパーパラメータ探索（50試行）が LightGBM にだけ追加されている。依存ライブラリにも optuna が増えた",
      files: ["train.py", "requirements.txt"],
    },
  ],
  [README_SHA]: [
    {
      type: "on_purpose",
      summary: "README にデータセットの件数・列・欠損についての説明を追加している",
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
  return templates.map((t) => ({ ...t, id: crypto.randomUUID(), saved: false }));
}

// ---- 先生モード ----

// 質問ごとに、回答に含まれていれば「理解できた」とするキーワードと、解説を持つ
type DemoQuestion = {
  layer: TeacherQuestion["layer"];
  question: string;
  keywords: string[];
  explanation: string;
};

const DROPNA_QUESTIONS: DemoQuestion[] = [
  {
    layer: "implementation",
    question:
      "train.py で欠損のある行を除外していますね。もともと、どんなエラーが起きていて、なぜ除外すると直るのですか？",
    keywords: ["NaN", "欠損", "扱えない", "StandardScaler", "ロジスティック"],
    explanation:
      "ロジスティック回帰や StandardScaler は欠損値（NaN）を入力にできないため、学習時に ValueError で落ちていました。dropna() で欠損のある行を消せば落ちなくなりますが、それは「エラーを消した」だけで、欠損の扱いを決めたわけではありません。",
  },
  {
    layer: "research",
    question:
      "欠損のある行を除外したことで、ロジスティック回帰との比較結果はどう変わりうると思いますか？",
    keywords: ["件数", "減", "偏り", "バイアス", "分布", "陽性率", "データセット"],
    explanation:
      "除外でデータ件数が減り、比較に使うデータセット自体が変わります。欠損は未受診の項目に多いので、除外された人に偏りがあれば陽性率や結果も変わりえます。除外の基準と件数を論文に書くこと、補完や LightGBM の欠損値処理と比べることを検討しましょう。",
  },
];

const CLASS_WEIGHT_QUESTIONS: DemoQuestion[] = [
  {
    layer: "research",
    question:
      'ベースラインにだけ class_weight="balanced" が入っています。この状態で「LightGBM のほうが良い」と言えますか？',
    keywords: ["条件", "揃", "公平", "両方", "不均衡"],
    explanation:
      "不均衡への対処がベースラインにだけ入っているので、比較条件が揃っていません。差が出ても、手法の差なのか対処の差なのか区別できません。両方に同じ対処を入れる（LightGBM にも class_weight や is_unbalance を指定する）必要があります。",
  },
];

function evaluationQuestion(evaluation: string): DemoQuestion {
  return {
    layer: "research",
    question: `評価方法を「${evaluation.slice(0, 60)}${evaluation.length > 60 ? "…" : ""}」としています。なぜこの評価指標を選んだのですか？`,
    keywords: ["不均衡", "陽性", "少ない", "正解率", "適合率", "再現率"],
    explanation:
      "陽性が少ない不均衡データでは、すべて陰性と予測するだけで正解率が高くなってしまいます。マクロ F1 は各クラスの適合率と再現率のバランスを平均するので、少数の陽性クラスの性能も評価に反映されます。",
  };
}

function genericProblemQuestion(problem: Finding): DemoQuestion {
  return {
    layer: "implementation",
    question: `「${problem.summary}」について、どんな問題が起きていて、なぜこの対処になったのか説明してください。`,
    keywords: ["エラー", "原因", "対処"],
    explanation: `記録では、問題は「${problem.error ?? "不明"}」、対処は「${problem.fix ?? "不明"}」でした。${problem.researchImpact?.exists ? `研究への影響：${problem.researchImpact.description}` : ""}`,
  };
}

// 質問の文面から、キーワードと解説を引けるようにしておく
const asked = new Map<string, DemoQuestion>();

function questionsFor(problem: Finding): DemoQuestion[] {
  if (problem.summary === DROPNA_SUMMARY) return DROPNA_QUESTIONS;
  if (problem.summary === CLASS_WEIGHT_SUMMARY) return CLASS_WEIGHT_QUESTIONS;
  return [genericProblemQuestion(problem)];
}

export function demoTeacherQuestions(
  req: TeacherQuestionsRequest,
): TeacherQuestion[] {
  const list: { q: DemoQuestion; findingId?: string }[] = [];
  for (const problem of req.problems.slice(0, 2)) {
    for (const q of questionsFor(problem)) list.push({ q, findingId: problem.id });
  }
  list.push({ q: evaluationQuestion(req.theme.evaluation) });

  return list.slice(0, 4).map(({ q, findingId }) => {
    asked.set(q.question, q);
    return {
      layer: q.layer,
      question: q.question,
      ...(findingId ? { findingId } : {}),
    };
  });
}

const DONT_KNOW = ["わからない", "わかりません", "分からない", "分かりません", "不明"];

export function demoTeacherFeedback(
  req: TeacherFeedbackRequest,
): TeacherFeedbackResponse {
  const q = asked.get(req.question.question);
  const answer = req.answer.trim();
  const dontKnow = DONT_KNOW.some((w) => answer.includes(w));
  const hits = q
    ? q.keywords.filter((k) => answer.toLowerCase().includes(k.toLowerCase()))
    : [];
  const understood = !dontKnow && (q ? hits.length > 0 : answer.length >= 20);
  const explanation = q?.explanation ?? "";

  if (understood) {
    return {
      understood,
      feedback: `よく理解できています。${hits.length > 0 ? `「${hits.join("」「")}」に触れられていて良いですね。` : ""}\n補足：${explanation}`,
    };
  }
  return {
    understood,
    feedback: `${dontKnow ? "正直に書いてくれてありがとう。ゼミの前に整理しておきましょう。" : "大事な点が抜けています。"}\n解説：${explanation}`,
  };
}
