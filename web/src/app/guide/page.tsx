// S-9 使い方（F-19）：アプリの流れと各機能を、実際の画面のスクリーンショットで紹介する。
// スクリーンショットは撮った時点の画面。機能や見た目を変えるたびには撮り直さず、最終提出の前にまとめて撮り直す

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "使い方 | TAZUNA" };

// 撮った日（撮り直したら変える）
const CAPTURED_AT = "2026年10月25日";

type Shot = { src: string; alt: string; width: number; height: number };

// 画像は web/public/guide/ に置く。幅・高さは画像の実寸（2倍の解像度で撮っている）
const shot = (
  name: string,
  alt: string,
  width: number,
  height: number,
): Shot => ({
  src: `/guide/${name}.png`,
  alt,
  width,
  height,
});

const SHOTS = {
  home: shot("home", "プロジェクト一覧", 3024, 1712),
  newProject: shot(
    "new-project",
    "新しいプロジェクトで研究の目的を書く画面",
    3024, 1712,
  ),
  settingsConnections: shot(
    "settings-connections",
    "設定画面の接続の欄",
    1890, 690,
  ),
  hookToast: shot(
    "hook-toast",
    "右下に出たフックの知らせ（判定中）",
    3024, 1712,
  ),
  review: shot("review", "判定結果の画面", 3024, 1712),
  reviewHidden: shot("review-hidden", "隠れた問題の項目", 2250, 980),
  reviewDiff: shot("review-diff", "関係するファイルの差分", 2180, 1060),
  themeDetail: shot("theme-detail", "プロジェクトの詳細と問題ログ", 3024, 1712),
  teacher: shot("teacher", "先生モードの問い返し", 1860, 1550),
  teacherPoint: shot(
    "teacher-point",
    "先生モードの1問ごとの講評と観点",
    1660, 1670,
  ),
  teacherResult: shot(
    "teacher-result",
    "先生モードの結果と答えられなかった点",
    1860, 1580,
  ),
  map: shot("map", "作業フローマップ", 3024, 1712),
  settingsAi: shot("settings-ai", "使う AI の設定", 1890, 940),
  settingsUsage: shot("settings-usage", "AI の使用量", 1890, 1065),
};

const HOOK_SETTINGS = `{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node /path/to/ng_2614/hook/research-check.mjs" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node /path/to/ng_2614/hook/research-check.mjs" }] }
    ]
  }
}`;

const STEPS = [
  {
    href: "#project",
    title: "プロジェクトを作る",
    text: "研究のリポジトリと、研究の目的（問い・手法・評価）を登録する",
  },
  {
    href: "#hook",
    title: "AI に作業させる",
    text: "いつもどおり Claude Code に頼む。変更は自動で届く",
  },
  {
    href: "#review",
    title: "判定を見る",
    text: "目的どおりの変更、隠れた問題、余計な追加に分かれる",
  },
  {
    href: "#teacher",
    title: "先生モードで確かめる",
    text: "AI がしたことを自分の言葉で説明できるか、問われる",
  },
  {
    href: "#map",
    title: "マップで全体を見る",
    text: "研究の工程のどこに影響があるかを1枚で見る",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-14 pb-16">
      <header>
        <p className="text-sm text-ink-3">使い方</p>
        <h1 className="mt-1 text-2xl font-bold">TAZUNA の使い方</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Claude Code などの AI
          に研究のコードを書かせると、頼んだこと以外に、エラーを黙って避けるための変更が混ざることがあります。データを正規化した、値に上限を付けた――動くようにはなっても、研究の前提が変わっているかもしれません。TAZUNA
          は、AI
          の変更を研究の目的と照らし合わせてそうした「隠れた問題」を見つけ、あなたが自分の言葉で説明できるかを確かめます。
        </p>
        <p className="mt-3 border-l-2 border-hair px-3 py-1 text-xs text-ink-3">
          画面は {CAPTURED_AT} に、サンプルのプロジェクト（DDPM
          のノイズスケジュールの比較）で、本物の Claude API
          を使って撮ったものです。今の画面とは少し違うことがあります。
        </p>
      </header>

      <section>
        <h2 className="rule-head text-lg font-bold">全体の流れ</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="block h-full border-t-2 border-ink p-3 hover:bg-paper-2"
              >
                <span className="font-serif text-sm font-bold text-ink">{i + 1}</span>
                <p className="mt-1 text-sm font-medium text-ink">
                  {s.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">
                  {s.text}
                </p>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <GuideSection id="project" title="1. プロジェクトを作る">
        <p>
          ホームの「＋
          新しいプロジェクト」から、研究のリポジトリ（GitHub）を選び、研究の目的を書きます。
          <strong>問い</strong>（何を明らかにしたいか）、<strong>手法</strong>
          （何と何を比べるか、何をそろえるか）、<strong>評価</strong>
          （どう測るか）の3つです。AI
          の変更は、いつもこの目的と照らし合わせて判定されます。
        </p>
        <Figure
          shot={SHOTS.newProject}
          caption="研究の目的を書く。評価の書き方（「元のスケールのまま測る」など）まで書いておくと、判定が鋭くなる"
        />
        <Figure
          shot={SHOTS.home}
          caption="ホーム：プロジェクトの一覧。取り込んだ回数と保存した問題の数が見える"
        />
      </GuideSection>

      <GuideSection id="connect" title="準備：Claude API と GitHub をつなぐ">
        <p>
          メニューの「設定」の「接続」で、Claude API キーと GitHub
          トークンを入れます。キーはこのアプリのサーバーが手元のファイルに保存し、画面には末尾4文字しか出しません。「接続を確かめる」で、実際に使えるかを試せます。
        </p>
        <Figure
          shot={SHOTS.settingsConnections}
          caption="設定 → 接続。.env.local に書いてあればその値を使い、画面で入れればそちらが優先される"
        />
        <p className="text-sm">
          お試しなら、画面右上の「デモモード」を入れると、キーが無くてもデモ用のデータで一通り動かせます（AI
          は呼びません）。
        </p>
      </GuideSection>

      <GuideSection
        id="hook"
        title="2. AI に作業させる（Claude Code のフック）"
      >
        <p>
          研究のリポジトリに Claude Code のフックを入れておくと、あなたが Claude
          Code に頼むたびに、依頼文・変更の差分・作業中に出たエラー・AI
          の最終報告が手元の TAZUNA
          に届き、自動で判定が始まります。コミットしなくても届きます。
        </p>
        <pre className="overflow-x-auto border border-hair bg-paper-2 p-4 font-mono text-xs leading-relaxed text-ink">
          {HOOK_SETTINGS}
        </pre>
        <p className="text-sm">
          研究のリポジトリの <code>.claude/settings.local.json</code>{" "}
          に書きます（コミットしない設定ファイル）。パスは TAZUNA
          を置いた場所に変えてください。詳しくは リポジトリの{" "}
          <code>hook/README.md</code> にあります。
        </p>
        <Figure
          shot={SHOTS.hookToast}
          caption="Claude Code が作業を終えると、画面の右下に知らせが出て判定が始まる。判定が終わると、隠れた問題と研究への影響の数が出て、結果を開ける"
        />
        <p className="text-sm">
          フックを使わないときは、プロジェクトの「コミットから取り込む」から GitHub
          のコミットを選んで判定することもできます。
        </p>
      </GuideSection>

      <GuideSection id="review" title="3. 判定を見る">
        <p>
          AI の変更は、<strong>目的どおり</strong>・<strong>隠れた問題</strong>
          ・<strong>余計な追加</strong>
          の3つに分かれます。隠れた問題には、AI
          が避けたエラー、どう対処したか、そして<strong>研究への影響</strong>
          （その対処で研究の前提や比べ方が変わらないか）が書かれます。
        </p>
        <Figure
          shot={SHOTS.review}
          caption="判定結果。依頼文（作業の目的）と、Claude Code 自身の報告も一緒に見られる"
        />
        <Figure
          shot={SHOTS.reviewHidden}
          caption="隠れた問題の例。サンプリングで点が範囲の外に飛ぶ警告が出ていたのに、Claude Code は対処しないまま比べていた。外れた点が距離を押し上げ、比べ方が崩れることを、研究への影響として拾っている。気になるものは「問題ログに保存」しておくと、先生モードで問われる"
        />
        <Figure
          shot={SHOTS.reviewDiff}
          caption="関係するファイルの差分も、その場で開いて確かめられる"
        />
      </GuideSection>

      <GuideSection id="log" title="問題ログ">
        <p>
          保存した問題は、プロジェクトの「問題ログ」に新しい順にたまります。ゼミや先生との打ち合わせの前に見返すのに使えます。
        </p>
        <Figure
          shot={SHOTS.themeDetail}
          caption="プロジェクトの詳細。研究の目的、取り込んだ変更の履歴、問題ログ"
        />
      </GuideSection>

      <GuideSection id="teacher" title="4. 先生モードで確かめる">
        <p>
          AI
          が先生役になり、保存した問題や研究の手法について、1問ずつ質問します。答えが足りないと、答えを教えるのではなく問い返して、あなたが自分で気づけるように導きます。最後に講評と、答えられなかった点が残ります。
        </p>
        <Figure
          shot={SHOTS.teacher}
          caption="「AIがやったのでわかりません」と答えても、先生は答えを言わずに問い返す"
        />
        <Figure
          shot={SHOTS.teacherPoint}
          caption="1問ごとに講評が出る。先生が想定していた観点のうち、言えたものに ✓ が付く"
        />
        <Figure
          shot={SHOTS.teacherResult}
          caption="最後に結果が出る。答えられなかった質問はやりとりごと残り、ゼミの前に見直せる"
        />
      </GuideSection>

      <GuideSection id="map" title="5. 作業フローマップで全体を見る">
        <p>
          研究の工程（調査・選定・実装・検証・報告）ごとに、タスクとその目的、状態、つながりを1枚にまとめます。research-workspace
          と実装リポジトリを読んで AI
          が作り、あとから手で直せます。変更を取り込むたびに更新され、隠れた問題が研究の前提に影響するときは、前の工程へ戻る矢印が引かれます。
        </p>
        <Figure
          shot={SHOTS.map}
          caption="作業フローマップ。変更を取り込むと自動で更新され、何が変わったかが上に出る。プロジェクトの画面の右側にも、帯として小さく出る"
        />
      </GuideSection>

      <GuideSection id="settings" title="使う AI と使用量">
        <p>
          判定・先生モード・作業フローマップのそれぞれで、使う Claude
          のモデルとエフォートを切り替えられます。呼んだ回数、トークン数、料金の目安も、今日の分と合計で見られます。
        </p>
        <Figure
          shot={SHOTS.settingsAi}
          caption="設定 → 使う AI。標準は速くて安い Haiku（この画面では Sonnet に変えている）。料金の倍率と、これまでの 1 回あたりの料金も出る"
        />
        <Figure
          shot={SHOTS.settingsUsage}
          caption="設定 → 使用量。この案内を作るために実際に使った分（判定・先生モード・作業フローマップ）"
        />
      </GuideSection>

      <p className="border-t border-hair pt-6 text-sm text-ink-3">
        さっそく始めるなら{" "}
        <Link href="/projects/new" className="link">
          新しいプロジェクトを作る
        </Link>
        。
      </p>
    </div>
  );
}

function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="rule-head text-lg font-bold">{title}</h2>
      <div className="space-y-4 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Figure({ shot, caption }: { shot: Shot; caption: string }) {
  return (
    <figure>
      <a href={shot.src} target="_blank" rel="noreferrer" title="原寸で開く">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes="(min-width: 768px) 768px, 100vw"
          className="w-full border border-hair"
        />
      </a>
      <figcaption className="mt-2 text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}
