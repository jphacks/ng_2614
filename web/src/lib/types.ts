// ドメインの型。docs/design.md の「8. データ設計」に対応する。
// ここを変えるときは、先に設計書を更新する。

// 研究テーマ（研究の層）
export type ResearchTheme = {
  id: string;
  name: string;
  repo: string; // "owner/name"
  question: string; // 何を明らかにしたいか
  method: string; // どの手法で（ベースラインを含む）
  evaluation: string; // どう評価するか（評価指標など）
  updatedAt: string; // ISO 8601
};

// API に渡す研究の目的（id や更新日時を含まない部分）
export type ResearchPurpose = Pick<
  ResearchTheme,
  "name" | "question" | "method" | "evaluation"
>;

export type FindingType = "on_purpose" | "hidden_problem" | "extra_addition";

export type ResearchImpact = {
  exists: boolean;
  description: string;
};

export type Finding = {
  id: string;
  type: FindingType;
  summary: string;
  files: string[];
  // 以下は type が "hidden_problem" のときだけ
  error?: string; // エラー内容
  errorIsInferred?: boolean; // 差分などからの推測なら true
  fix?: string; // 対処方法
  researchImpact?: ResearchImpact;
  saved?: boolean; // 問題ログに保存したか
};

// 取り込み元。"claude_code_hook" は Claude Code のフック（F-13）で届いたもの
export type ReviewSource = "commit" | "claude_code_hook";

// 会話記録から取り出した、失敗したコマンドとその出力（F-13）
export type ObservedError = {
  // 失敗したコマンド（"failed"）か、成功したコマンドの出力に出たエラー（"in_output"）か。無いときは "failed"
  kind?: "failed" | "in_output";
  tool: string; // "Bash" など
  input: string; // 実行したコマンドなど
  output: string; // エラーの出力（送るときは2,000文字、保存するときは500文字まで）
};

// 取り込んだ変更と判定（実装の層）
export type Review = {
  id: string;
  themeId: string;
  source?: ReviewSource; // 無いときは "commit"（フック導入前のデータ）
  purpose: string; // 作業の目的（フックのときは今回の依頼文）
  commitSha: string; // フックのときは ""
  commitMessage: string; // フックのときは ""
  // 以下はフックのときだけ
  earlierPrompts?: string[]; // 同じ会話でそれまでにした依頼文（古い順、直近5件まで）
  observedErrors?: ObservedError[]; // 作業中に実際に起きたエラー
  generatedFiles?: string[]; // 実行でできたファイル（実験の出力。中身は送らない）
  aiReport?: string; // AI の最終報告（3,000文字まで）
  headMoved?: boolean; // 作業中に pull やブランチの切り替えがあった
  unopened?: boolean; // フックで届いて、まだ判定結果（S-3）で開いていない。無いときは開いた扱い
  createdAt: string; // ISO 8601
  findings: Finding[];
};

export type QuestionLayer = "research" | "implementation";

// 先生が想定している解答の観点（F-8 の採点に使う）
export type Viewpoint = {
  id: string; // 質問の中で一意（"v1" など）
  text: string; // 1つの観点に1つの主張
  required: boolean; // true の観点がすべて言えたら「理解できた」で終える
};

// 先生モードの1つの質問の中のやりとり（問い返し）
export type TeacherTurn = {
  role: "teacher" | "student";
  text: string;
};

export type TeacherItem = {
  layer: QuestionLayer;
  question: string;
  findingId?: string; // 保存した問題についての質問なら、その Finding の id
  answer: string; // 学生の最後の回答
  feedback: string; // 最後の講評
  understood: boolean; // false のものを「答えられなかった点」として残す
  turns?: TeacherTurn[]; // 最初の質問からのやりとり全体（問い返し型になる前の記録には無い）
  viewpoints?: Viewpoint[]; // 想定解答の観点（観点による採点の前の記録には無い）
  covered?: string[]; // 言えた観点の id
};

// 先生モード
export type TeacherSession = {
  id: string;
  themeId: string;
  createdAt: string; // ISO 8601
  items: TeacherItem[];
};

// 先生のキャラクター（F-20）。プロジェクトごとに1つ。見た目だけに使い、AI には送らない
export type TeacherPersona = {
  themeId: string;
  name: string; // 空なら「先生」と出す
  image?: string; // 256×256 の JPEG の data URL
  updatedAt: string; // ISO 8601
};

// ---- 作業フローマップ（F-15） ----

// 状態。画面ではレーンに合わせた言葉で出す（例：調査の doing は「比較中」）
export type MapStatus = "todo" | "doing" | "waiting" | "done" | "rejected";

// 状態をどう決めたか。優先順位は manual ＞ record ＞ ai
export type MapStatusSource =
  | "manual" // 人が手で変えた。以後は自動で上書きしない
  | "record" // ワークスペースの記録（frontmatter・チェックボックス）から決めた
  | "ai"; // 記録に無く、AI が本文から推測した

// 人の確認の状態
export type MapReviewState =
  | "unconfirmed" // AI が作ったまま
  | "confirmed" // 人が確認した。AI は状態だけ更新できる
  | "edited"; // 人が直した。AI はタイトル・目的・状態を上書きしない

// 出典の種類。research-workspace のフォルダと、実装リポジトリのコミット
export type SourceKind =
  | "brainstorm"
  | "spec"
  | "experiment"
  | "meeting"
  | "material"
  | "paper"
  | "todo"
  | "commit";

// レーン（工程）。kinds は、そのレーンに入る出典の種類
export type MapPhase = {
  id: string;
  name: string;
  order: number;
  kinds: SourceKind[];
};

// マイルストーン（README の「マイルストーン」の1行）。タスクに付けるラベル
export type MapMilestone = {
  id: string;
  title: string;
  done: boolean;
};

export type MapSource = {
  kind: SourceKind;
  path: string; // ワークスペースのパス、またはコミットの SHA
  url?: string;
  label?: string; // 画面に出す短い名前
};

// タスクとサブタスク。parentId があればサブタスク
export type MapTask = {
  id: string;
  // ワークスペースから作ったタスクの、作り直しても変わらない目印。
  // ドキュメントならワークスペースのパス、コミットなら "commit:<sha>"、AI がまとめた親なら "group:..."。
  // 人が足したタスクとデモのタスクには無い
  key?: string;
  phaseId: string;
  parentId?: string;
  milestoneId?: string; // 付かないタスクもある
  order: number; // 同じレーン・同じ親の中での並び順（小さいほど上）
  title: string;
  purpose: string;
  status: MapStatus;
  statusSource: MapStatusSource;
  statusRaw?: string; // 元の文言（例："cpu-pass-gpu-not-run"、"draft"）
  result?: string; // 結果（例："L0〜L3 PASS"）。状態とは別
  rejectReason?: string; // status が "rejected" のときは必須
  sources: MapSource[];
  commitShas: string[];
  reviewIds: string[];
  flag?: "unrecorded"; // どのドキュメントにも出てこない実装
  origin: "ai" | "human";
  review: MapReviewState;
};

// タスク同士のつながり。flow は工程の流れ（例：調査 → 選定）、
// impact は隠れた問題が研究の前提に影響すること（逆向きの矢印）
export type MapLink = {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  kind: "flow" | "impact";
  reason?: string;
  findingId?: string; // impact のとき、もとになった隠れた問題
};

// 人が消したタスク、または却下した提案。同じものを AI が再び提案しないように覚えておく
export type MapRejected = {
  title: string;
  reason?: string;
  at: string; // ISO 8601
  tasks: MapTask[]; // 戻すとき用。消したタスクとそのサブタスク
  links: MapLink[]; // 戻すとき用。消したタスクにつながっていたリンク
};

// 直近の自動更新の記録（判定結果の画面に出す、マップで「更新」の印を付ける）
export type MapUpdateRecord = {
  reviewId: string;
  at: string; // ISO 8601
  summaries: string[]; // 反映した変更の説明（1件1行）
  changedTaskIds: string[];
};

export type WorkflowMap = {
  themeId: string;
  workspaceRepo?: string; // "owner/name"
  workspaceProject?: string; // .research/lab/projects/<project>
  workspaceSha?: string; // 前回読んだワークスペースのコミット
  phases: MapPhase[];
  milestones: MapMilestone[];
  tasks: MapTask[];
  links: MapLink[];
  rejected: MapRejected[];
  appliedReviewIds: string[]; // 自動更新を済ませた判定。同じ判定で2回更新しない
  lastUpdate?: MapUpdateRecord;
  previous?: WorkflowMapSnapshot; // 直近の自動更新の取り消し用
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type WorkflowMapSnapshot = Omit<WorkflowMap, "previous">;

// 自動更新で AI（デモではデモデータ）が返す変更。reason は「なぜこの変更か」
export type MapOp =
  | {
      op: "add_task";
      tempId: string; // 同じ一覧の中のほかの op から parentId などで参照できる仮の id
      key?: string; // ワークスペースから作ったタスクの目印（MapTask.key）
      phaseId: string;
      parentId?: string; // 既存のタスクの id、または同じ一覧の add_task の tempId
      milestoneId?: string;
      title: string;
      purpose: string;
      status: MapStatus;
      statusSource: "record" | "ai";
      statusRaw?: string;
      result?: string;
      rejectReason?: string;
      sources: MapSource[];
      commitShas: string[];
      reviewIds: string[];
      flag?: "unrecorded";
      reason: string;
    }
  | {
      op: "update_task";
      taskId: string;
      title?: string;
      purpose?: string;
      status?: MapStatus;
      statusSource?: "record" | "ai";
      statusRaw?: string;
      result?: string;
      rejectReason?: string;
      reason: string;
    }
  | {
      op: "link_task"; // 出典・コミット・判定を足す（文言は変えない）
      taskId: string;
      sources?: MapSource[];
      commitShas?: string[];
      reviewIds?: string[];
      reason: string;
    }
  | {
      op: "add_link";
      fromTaskId: string; // 既存の id、または add_task の tempId
      toTaskId: string;
      kind: "flow" | "impact";
      findingId?: string;
      reason: string;
    };
