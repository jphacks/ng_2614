"use client";

// S-5 先生モード。AIが先生役で質問し、答えに問い返していく（F-8、問い返し型）。

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postTeacherQuestions, postTeacherTurn } from "@/lib/api-client";
import type { TeacherQuestion } from "@/lib/api-types";
import {
  DEFAULT_TEACHER_NAME,
  getTeacherPersona,
  getTheme,
  listSavedProblems,
  listTeacherSessions,
  newId,
  nowIso,
  saveTeacherSession,
} from "@/lib/storage";
import { MAX_STUDENT_TURNS, countStudentTurns } from "@/lib/teacher-rules";
import { buildThread } from "@/lib/teacher-thread";
import { useScrollToEnd } from "@/lib/use-scroll-to-end";
import type {
  Finding,
  ResearchTheme,
  TeacherItem,
  TeacherPersona,
  TeacherSession,
  TeacherTurn,
} from "@/lib/types";
import { ChatComposer } from "@/components/teacher/chat-composer";
import { LayerBadge } from "@/components/teacher/layer-badge";
import { TeacherPersonaEditor } from "@/components/teacher/teacher-persona-editor";
import { ThreadView } from "@/components/teacher/thread-view";
import {
  UnansweredList,
  collectMisses,
} from "@/components/teacher/unanswered-list";

type Phase = "idle" | "loadingQuestions" | "answering" | "done";

type Result = { feedback: string; understood: boolean };

export default function TeacherPage() {
  const params = useParams<{ themeId: string }>();
  const themeId = params.themeId;

  // undefined: 読み込み中、null: 見つからない
  const [theme, setTheme] = useState<ResearchTheme | null | undefined>(
    undefined,
  );
  const [problems, setProblems] = useState<Finding[]>([]);
  const [pastSessions, setPastSessions] = useState<TeacherSession[]>([]);
  const [persona, setPersona] = useState<TeacherPersona | undefined>(undefined);

  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState("");
  const [sessionCreatedAt, setSessionCreatedAt] = useState("");
  const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState<TeacherItem[]>([]);
  const [turns, setTurns] = useState<TeacherTurn[]>([]); // 今の質問のやりとり
  const [covered, setCovered] = useState<string[]>([]); // 今の質問で言えた観点の id
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [composerHeight, setComposerHeight] = useState(160); // 下に固定した入力欄の高さ（px）
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null); // 送信中の回答（返事が来るまでスレッドに出す）
  const [error, setError] = useState<string | null>(null);

  // 全部の質問をつなげた1本のスレッド。早期 return より前に作る（フックの順序を保つため）
  const entries = buildThread({
    questions,
    items,
    currentIndex: index,
    currentTurns: turns,
    currentResult: result,
    currentCovered: covered,
  });
  // 返事を待っている間も、送った回答をスレッドに出す。key は返事が来たあとの学生の発言と同じにして、演出をやり直さない
  if (pendingAnswer !== null) {
    entries.push({
      kind: "message",
      key: `q${index}-t${turns.length}`,
      role: "student",
      text: pendingAnswer,
    });
  }
  const thinking = phase === "loadingQuestions" || submitting;
  const composerShown = phase === "answering" && result === null;
  // 新しい発言が来たら、スレッドの末尾までスクロールする
  // 失敗したときはエラー文がスレッドの末尾に出るので、そこまで動かす
  const endRef = useScrollToEnd<HTMLDivElement>([
    entries.length,
    thinking,
    phase,
    error,
  ]);
  // 講評が出たら「次の質問へ」にフォーカスを移す
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const showNext = phase === "answering" && result !== null;
  useEffect(() => {
    if (showNext) nextButtonRef.current?.focus({ preventScroll: true });
  }, [showNext, index]);

  useEffect(() => {
    setTheme(getTheme(themeId) ?? null);
    setProblems(listSavedProblems(themeId).map((p) => p.finding));
    setPastSessions(listTeacherSessions(themeId));
    setPersona(getTeacherPersona(themeId));
  }, [themeId]);

  function purposeOf(t: ResearchTheme) {
    return {
      name: t.name,
      question: t.question,
      method: t.method,
      evaluation: t.evaluation,
    };
  }

  function openQuestion(q: TeacherQuestion) {
    setTurns([{ role: "teacher", text: q.question }]);
    setCovered([]);
    setAnswer("");
    setResult(null);
    setError(null);
  }

  async function start() {
    if (!theme) return;
    setError(null);
    setPhase("loadingQuestions");
    try {
      const res = await postTeacherQuestions({
        theme: purposeOf(theme),
        problems,
      });
      setQuestions(res.questions);
      setIndex(0);
      setItems([]);
      setSessionId(newId());
      setSessionCreatedAt(nowIso());
      openQuestion(res.questions[0]);
      setPhase("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "質問を作れませんでした。");
      setPhase("idle");
    }
  }

  // text を渡さなければ入力欄の回答を送る（「分かりません」ボタンは文面を渡す）
  async function submitAnswer(text = answer) {
    if (!theme || submitting || text.trim() === "") return;
    const q = questions[index];
    const sent: TeacherTurn[] = [
      ...turns,
      { role: "student", text: text.trim() },
    ];
    // 入力欄の文面を送るときだけ、入力欄を空にする（「分かりません」ボタンでは書きかけを残す）
    const fromComposer = text === answer;
    setError(null);
    setSubmitting(true);
    setPendingAnswer(text.trim());
    if (fromComposer) setAnswer("");
    try {
      const res = await postTeacherTurn({
        theme: purposeOf(theme),
        question: q,
        problem: q.findingId
          ? problems.find((p) => p.id === q.findingId)
          : undefined,
        turns: sent,
        covered,
      });
      const next: TeacherTurn[] = [...sent, { role: "teacher", text: res.message }];
      setTurns(next);
      setCovered(res.covered);
      setAnswer("");
      if (!res.done) return;

      setResult({ feedback: res.message, understood: res.understood });
      // 1問ごとに保存しておく（途中でやめても記録が残る）
      const nextItems: TeacherItem[] = [
        ...items,
        {
          layer: q.layer,
          question: q.question,
          ...(q.findingId ? { findingId: q.findingId } : {}),
          answer: sent[sent.length - 1].text,
          feedback: res.message,
          understood: res.understood,
          turns: next,
          viewpoints: q.viewpoints,
          covered: res.covered,
        },
      ];
      setItems(nextItems);
      saveTeacherSession({
        id: sessionId,
        themeId,
        createdAt: sessionCreatedAt,
        items: nextItems,
      });
      setPastSessions(listTeacherSessions(themeId));
    } catch (e) {
      // 送れなかった回答は入力欄に戻す
      if (fromComposer) setAnswer(text);
      setError(e instanceof Error ? e.message : "先生の返事を受け取れませんでした。");
    } finally {
      setPendingAnswer(null);
      setSubmitting(false);
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setPhase("done");
    } else {
      setIndex(index + 1);
      openQuestion(questions[index + 1]);
    }
  }

  if (theme === undefined) {
    return <p className="text-ink-3">読み込み中…</p>;
  }

  if (theme === null) {
    return (
      <div>
        <p>プロジェクトが見つかりません。</p>
        <Link href="/" className="link mt-2 inline-block">
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  const current = questions[index];
  const misses = collectMisses(pastSessions);
  const understoodCount = items.filter((i) => i.understood).length;
  const answeredCount = countStudentTurns(turns);
  const teacher = {
    name: persona?.name || DEFAULT_TEACHER_NAME,
    image: persona?.image,
  };
  const errorAlert = (
    <p
      role="alert"
      className="mt-4 border-l-2 border-pen pl-3 text-sm text-pen"
    >
      {error}
    </p>
  );

  return (
    <div>
      <Link
        href={`/themes/${themeId}`}
        className="link-quiet text-sm"
      >
        ← {theme.name} に戻る
      </Link>
      <h1 className="mt-2 text-2xl">先生モード</h1>
      <div className="mt-3">
        <TeacherPersonaEditor
          themeId={themeId}
          persona={persona}
          onChange={setPersona}
        />
      </div>
      <p className="mt-2 text-xs text-ink-2">
        研究の目的・保存した問題・あなたの回答は AI（Claude）に送られます。
      </p>

      {error && phase === "idle" && errorAlert}

      {phase === "idle" && (
        <section className="mt-6">
          <p className="text-sm text-ink-2">
            保存した問題：{problems.length} 件
            {problems.length === 0 &&
              "（無くても、研究の目的についての質問ができます）"}
          </p>
          <button
            type="button"
            onClick={start}
            className="btn-primary mt-3"
          >
            {error ? "もう一度質問してもらう" : "先生に質問してもらう"}
          </button>
        </section>
      )}

      {phase !== "idle" && (
        <section className="mt-6">
          <ThreadView
            entries={entries}
            teacher={teacher}
            thinking={thinking}
            action={
              showNext ? (
                <button
                  ref={nextButtonRef}
                  type="button"
                  onClick={next}
                  className="btn-primary"
                >
                  {index + 1 >= questions.length ? "結果を見る" : "次の質問へ"}
                </button>
              ) : undefined
            }
          />
          {/* 会話の途中で失敗したときは、スクロールした先（スレッドの末尾）に出す */}
          {error && errorAlert}
        </section>
      )}

      {phase === "done" && (
        <section className="mt-6 rounded-[4px] border border-hair bg-sheet p-4">
          <h2>おつかれさまでした</h2>
          <p className="mt-2 text-sm">
            {items.length} 問中 {understoodCount} 問を理解できていました。
            {items.length - understoodCount > 0 &&
              "理解できていなかった点は、下の「答えられなかった点」に残っています。"}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setQuestions([]);
                setItems([]);
              }}
              className="btn-primary"
            >
              もう一度質問してもらう
            </button>
            <Link
              href={`/themes/${themeId}`}
              className="btn"
            >
              テーマの詳細へ戻る
            </Link>
          </div>
        </section>
      )}

      {/* スレッドの末尾の目印。入力欄が下に固定されているあいだは、最後の吹き出しが隠れないように余白を取る */}
      <div
        ref={endRef}
        aria-hidden="true"
        style={{ height: composerShown ? composerHeight + 16 : 0 }}
      />

      {(phase === "idle" || phase === "done") && (
        <UnansweredList misses={misses} teacher={teacher} />
      )}

      {composerShown && current && (
        <ChatComposer
          value={answer}
          onChange={setAnswer}
          onSubmit={() => submitAnswer()}
          onDontKnow={() => submitAnswer("分かりません")}
          disabled={submitting}
          onHeightChange={setComposerHeight}
          status={
            <>
              <span>
                質問 {index + 1} / {questions.length}
              </span>
              <LayerBadge layer={current.layer} />
              <span>
                言えた観点 {covered.length} / {current.viewpoints.length}
              </span>
              <span>あと {MAX_STUDENT_TURNS - answeredCount} 回答えられます</span>
            </>
          }
        />
      )}
    </div>
  );
}
