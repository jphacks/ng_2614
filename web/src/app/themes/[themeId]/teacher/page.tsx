"use client";

// S-5 先生モード。AIが先生役で質問し、答えに問い返していく（F-8、問い返し型）。

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { postTeacherQuestions, postTeacherTurn } from "@/lib/api-client";
import type { TeacherQuestion } from "@/lib/api-types";
import {
  getTheme,
  listSavedProblems,
  listTeacherSessions,
  newId,
  nowIso,
  saveTeacherSession,
} from "@/lib/storage";
import { MAX_STUDENT_TURNS, countStudentTurns } from "@/lib/teacher-rules";
import type {
  Finding,
  ResearchTheme,
  TeacherItem,
  TeacherSession,
  TeacherTurn,
} from "@/lib/types";
import { Conversation } from "@/components/teacher/conversation";
import { LayerBadge } from "@/components/teacher/layer-badge";
import { ViewpointList } from "@/components/teacher/viewpoint-list";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getTheme(themeId) ?? null);
    setProblems(listSavedProblems(themeId).map((p) => p.finding));
    setPastSessions(listTeacherSessions(themeId));
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
    setError(null);
    setSubmitting(true);
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
      // 送れなかった回答は入力欄に残したまま
      setError(e instanceof Error ? e.message : "先生の返事を受け取れませんでした。");
    } finally {
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

  return (
    <div>
      <Link
        href={`/themes/${themeId}`}
        className="link-quiet text-sm"
      >
        ← {theme.name} に戻る
      </Link>
      <h1 className="mt-2 text-2xl font-bold">先生モード</h1>
      <p className="mt-2 text-xs text-ink-3">
        研究の目的・保存した問題・あなたの回答は AI（Claude）に送られます。
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-pen pl-3 text-sm text-pen"
        >
          {error}
        </p>
      )}

      {(phase === "idle" || phase === "loadingQuestions") && (
        <section className="mt-6">
          <p className="text-sm text-ink-2">
            保存した問題：{problems.length} 件
            {problems.length === 0 &&
              "（無くても、研究の目的についての質問ができます）"}
          </p>
          <button
            type="button"
            onClick={start}
            disabled={phase === "loadingQuestions"}
            className="btn-primary mt-3"
          >
            {phase === "loadingQuestions"
              ? "先生が質問を考えています…"
              : error
                ? "もう一度質問してもらう"
                : "先生に質問してもらう"}
          </button>
        </section>
      )}

      {phase === "answering" && current && (
        <section className="mt-6 border-t border-ink pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-2">
              質問 {index + 1} / {questions.length}
            </span>
            <LayerBadge layer={current.layer} />
            {result === null && (
              <span className="flex gap-x-3 text-xs text-ink-3">
                <span>
                  言えた観点 {covered.length} / {current.viewpoints.length}
                </span>
                <span>あと {MAX_STUDENT_TURNS - answeredCount} 回答えられます</span>
              </span>
            )}
          </div>

          <div className="mt-4">
            <Conversation turns={result ? turns.slice(0, -1) : turns} />
          </div>

          {result === null ? (
            <div className="mt-4">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitAnswer();
                }}
                disabled={submitting}
                rows={4}
                placeholder="あなたの回答（分からないときは「分かりません」ボタン）"
                className="field"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => submitAnswer()}
                  disabled={submitting || answer.trim() === ""}
                  className="btn-primary"
                >
                  {submitting ? "先生が考えています…" : "答える"}
                </button>
                <button
                  type="button"
                  onClick={() => submitAnswer("分かりません")}
                  disabled={submitting}
                  className="btn"
                >
                  分かりません
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              {/* 講評は先生の赤ペンの書き込み。左の余白に赤ペンの縦線を引く */}
              <div className="border-l-2 border-pen pl-4">
                <p className="pen-note text-base font-bold">
                  <span aria-hidden="true" className="mr-1">
                    {result.understood ? "◎" : "△"}
                  </span>
                  講評：{result.understood ? "理解できた" : "まだ理解できていない"}
                </p>
                <p className="pen-note mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {result.feedback}
                </p>
                <div className="mt-3 border-t border-hair pt-3">
                  <ViewpointList viewpoints={current.viewpoints} covered={covered} />
                </div>
              </div>
              <button
                type="button"
                onClick={next}
                className="btn-primary mt-3"
              >
                {index + 1 >= questions.length ? "結果を見る" : "次の質問へ"}
              </button>
            </div>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="mt-6 border-t border-ink pt-4">
          <h2 className="font-bold">おつかれさまでした</h2>
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

      <UnansweredList misses={misses} />
    </div>
  );
}
