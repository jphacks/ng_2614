"use client";

// 先生モード（F-8）の議論を、全部の質問をつなげた1本のスレッドとして描画する。
// 質問の区切り線・先生と学生の吹き出し・講評（先生の吹き出し＋観点）を並べ、考えている間は「入力中」の吹き出しを出す。
// 表示した時点で既にあった発言は演出なし、あとから増えた発言だけ「ふわっと出る・1文字ずつ打ち出す」演出をする。

import { useEffect, useRef, useState } from "react";
import { layerLabel, type ThreadEntry } from "@/lib/teacher-thread";
import { StudentAvatar } from "./student-avatar";
import { TeacherAvatar, type TeacherLook } from "./teacher-avatar";
import { TypewriterText } from "./typewriter-text";
import { TypingBubble } from "./typing-bubble";
import { ViewpointList } from "./viewpoint-list";

export function ThreadView({
  entries,
  teacher,
  thinking,
  action,
}: {
  entries: ThreadEntry[];
  teacher: TeacherLook;
  thinking: boolean;
  // 最後の発言の直後に出すもの（「次の質問へ」ボタンなど）
  action?: React.ReactNode;
}) {
  // 最初の描画かどうか。マウント後の effect で false にする
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  // 打ち出しが終わった講評の key。観点の一覧は、講評の文が出きってから出す
  const [typedKeys, setTypedKeys] = useState<ReadonlySet<string>>(new Set());
  function markTyped(key: string) {
    setTypedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  // key ごとに「演出するか」を、その key を初めて見たときに1回だけ決めて覚える。
  // 描画のたびに値が変わると、打ち出しが途中でやり直し・即完了になってしまうため
  const animateByKey = useRef(new Map<string, boolean>());
  function isNew(key: string): boolean {
    const map = animateByKey.current;
    let value = map.get(key);
    if (value === undefined) {
      value = !firstRender.current;
      map.set(key, value);
    }
    return value;
  }

  return (
    <ul className="space-y-3">
      {entries.map((e) => {
        const animate = isNew(e.key);
        const appear = animate ? "chat-appear " : "";

        if (e.kind === "divider") {
          return (
            <li
              key={e.key}
              className={`${appear}flex items-center gap-3 py-2 text-xs text-ink-3`}
            >
              <span aria-hidden="true" className="h-px flex-1 bg-hair" />
              <span>
                質問 {e.questionNumber} / {e.total}・{layerLabel(e.layer)}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-hair" />
            </li>
          );
        }

        if (e.kind === "message" && e.role === "student") {
          return (
            <li
              key={e.key}
              className={`${appear}flex items-start justify-end gap-2`}
            >
              <div className="max-w-[85%] rounded-[6px] bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-white">
                <span className="mb-0.5 block text-xs opacity-70">あなた</span>
                {e.text}
              </div>
              <StudentAvatar />
            </li>
          );
        }

        if (e.kind === "message") {
          return (
            <li
              key={e.key}
              className={`${appear}flex items-start justify-start gap-2`}
            >
              <TeacherAvatar teacher={teacher} />
              <div className="max-w-[85%] rounded-[6px] border border-hair bg-sheet px-3 py-2 font-hand text-[17px] leading-relaxed whitespace-pre-wrap text-pen">
                <span className="mb-0.5 block text-xs opacity-70">
                  {teacher.name}
                </span>
                <TypewriterText text={e.text} animate={animate} />
              </div>
            </li>
          );
        }

        // 講評。先生の発言として、理解できたかの印と想定していた観点を付ける
        return (
          <li
            key={e.key}
            className={`${appear}flex items-start justify-start gap-2`}
          >
            <TeacherAvatar teacher={teacher} />
            <div
              className={`max-w-[85%] rounded-[6px] border bg-sheet px-3 py-2 text-sm text-ink ${
                e.understood ? "border-mint" : "border-pen/50"
              }`}
            >
              <div className="mb-0.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-3">{teacher.name}</span>
                <span
                  className={`tag ${e.understood ? "text-mint-ink" : "text-pen"}`}
                >
                  {e.understood ? "✓ 理解できた" : "まだ理解できていない"}
                </span>
              </div>
              <p className="whitespace-pre-wrap font-hand text-[17px] leading-relaxed text-pen">
                <TypewriterText
                  text={e.text}
                  animate={animate}
                  onDone={() => markTyped(e.key)}
                />
              </p>
              {(!animate || typedKeys.has(e.key)) && (
                <div className="mt-3 border-t border-hair pt-3">
                  <ViewpointList viewpoints={e.viewpoints} covered={e.covered} />
                </div>
              )}
            </div>
          </li>
        );
      })}
      {action && <li className="chat-appear">{action}</li>}
      {thinking && (
        <li>
          <TypingBubble teacher={teacher} />
        </li>
      )}
    </ul>
  );
}
