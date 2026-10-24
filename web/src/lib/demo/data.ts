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
};

const DROPNA_QUESTION: DemoQuestion = {
  layer: "implementation",
  question:
    "train.py で欠損のある行を除外していますね。なぜこの対処をしたのですか？",
  viewpoints: [
    {
      text: "ロジスティック回帰や StandardScaler が欠損値（NaN）を扱えず、学習時にエラーになった",
      required: false,
      keywords: ["NaN", "扱えな", "受け付けな", "StandardScaler", "ロジスティック"],
      probe: "そのエラーは、データのどこが原因で、どの処理で起きていたのですか？",
    },
    {
      text: "欠損のある行を除くと件数が減り、残ったデータに偏りが出うる",
      required: true,
      keywords: ["件数", "減", "偏り", "バイアス", "分布", "性質"],
      probe:
        "欠損している行を消すと、残ったデータはもとのデータと同じ性質だと言えますか？",
    },
    {
      text: "その結果、ベースラインとの比較の条件や結論が変わりうる",
      required: true,
      keywords: ["比較", "公平", "条件", "ベースライン", "結論"],
      probe: "それは、ベースラインとの比較実験にとって問題になりますか？",
    },
  ],
  homework:
    "除外で何件減ったか、除外された行に偏りがないかを確かめ、除外と補完のどちらが研究の問いに合うか説明できるようにしてください。",
  aiDidIt:
    "AIがやったかどうかは関係ありません。train.py の df.dropna() の行を見て、何をしているか説明してください。",
};

const CLASS_WEIGHT_QUESTION: DemoQuestion = {
  layer: "research",
  question:
    'ロジスティック回帰にだけ class_weight="balanced" が入っています。なぜこの重みが必要だったのですか？',
  viewpoints: [
    {
      text: "陽性が少ないため、重みなしではすべて陰性と予測してしまう",
      required: false,
      keywords: ["陰性", "不均衡", "少な", "偏っ"],
      probe:
        "陽性が少ないと、重みなしのロジスティック回帰は何を予測するようになりますか？",
    },
    {
      text: "不均衡への対処がロジスティック回帰にしか入っておらず、LightGBM と条件が揃っていない",
      required: true,
      keywords: ["LightGBMには", "LightGBM には", "片方", "両方", "揃っ", "揃え"],
      probe: "その対処は、LightGBM 側にも入っていますか？",
    },
    {
      text: "そのままでは、差が手法の違いなのか対処の違いなのか区別できない",
      required: true,
      keywords: ["区別", "手法の差", "手法の違い", "公平", "言えな"],
      probe: "その状態で「LightGBM のほうが良い」と言えますか？",
    },
  ],
  homework:
    "両方の手法で不均衡への対処を揃えたときに、比較の結論が変わるかを確かめてください。",
  aiDidIt:
    "AIがやったかどうかは関係ありません。make_baseline() の中を見て、何を指定しているか説明してください。",
};

function evaluationQuestion(evaluation: string): DemoQuestion {
  const short =
    evaluation.length > 40 ? `${evaluation.slice(0, 40)}…` : evaluation;
  return {
    layer: "research",
    question: `評価を「${short}」としています。なぜこの評価指標を選んだのですか？`,
    viewpoints: [
      {
        text: "陽性が少ない不均衡データでは、すべて陰性と予測するだけで正解率が高くなる",
        required: true,
        keywords: ["不均衡", "正解率", "陰性", "少な"],
        probe:
          "このデータで、すべて陰性と予測するモデルの正解率はどのくらいになりますか？",
      },
      {
        text: "マクロ F1 は各クラスの F1 を平均するので、少数の陽性クラスの性能も評価に反映される",
        required: true,
        keywords: ["各クラス", "平均", "少数", "陽性クラス", "適合率", "再現率"],
        probe: "この指標は、その問題をどう避けていますか？",
      },
    ],
    homework:
      "すべて陰性と予測するモデルの正解率とマクロ F1 を実際に計算して、比べておいてください。",
    aiDidIt:
      "評価指標を決めるのはあなたです。研究の問いに照らして、何を測りたいのか説明してください。",
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
  if (problem.summary === DROPNA_SUMMARY) return DROPNA_QUESTION;
  if (problem.summary === CLASS_WEIGHT_SUMMARY) return CLASS_WEIGHT_QUESTION;
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
    const missing = viewpoints.filter((v) => v.required && !covered.includes(v.id));
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
  else if (isDontKnow(last)) message = `では、ここから考えてください。${probe}`;
  else if (covered.length === req.covered.length)
    message = `それでは理由になっていません。${probe}`;
  else message = probe;
  return { done, understood, covered, message };
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
    feedback: understood ? "要点は押さえられています。" : "核心まで届いていません。",
  };
}
