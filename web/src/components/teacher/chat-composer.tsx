"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const DEFAULT_PLACEHOLDER = "あなたの回答（分からないときは「分かりません」ボタン）";
const MAX_ROWS = 6;

// 先生モードの回答入力欄。画面の下に固定して（sticky）、チャットアプリのように使えるようにする。
// 入力に合わせて高さが伸び、Ctrl / ⌘ + Enter で送れる。送信中は無効にし、終わったら入力欄にフォーカスを戻す
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onDontKnow,
  disabled,
  placeholder = DEFAULT_PLACEHOLDER,
  status,
  onHeightChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDontKnow: () => void;
  disabled: boolean;
  placeholder?: string;
  // 入力欄の上に小さく出す進み具合など
  status?: React.ReactNode;
  // 入力欄全体の高さ（px）が変わるたびに知らせる。スレッドの下に取る余白の計算に使う
  onHeightChange?: (px: number) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasDisabled = useRef(disabled);
  const rootRef = useRef<HTMLDivElement>(null);
  const heightCallback = useRef(onHeightChange);
  useEffect(() => {
    heightCallback.current = onHeightChange;
  });

  // 入力欄全体の高さを測って伝える（最初の1回と、伸び縮みしたとき）
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      // 余白と枠線を含む高さ（border-box）を伝える
      const h =
        entries[0]?.borderBoxSize?.[0]?.blockSize ??
        el.getBoundingClientRect().height;
      heightCallback.current?.(Math.ceil(h));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 内容に合わせて高さを伸ばす。6行を超えたら中でスクロールさせる
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const maxHeight = lineHeight * MAX_ROWS + padding + border;
    el.style.height = `${Math.min(el.scrollHeight + border, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight + border > maxHeight ? "auto" : "hidden";
  }, [value]);

  // 先生の返事が終わったら、続けて書けるように入力欄にフォーカスを戻す
  useEffect(() => {
    if (wasDisabled.current && !disabled) textareaRef.current?.focus({ preventScroll: true });
    wasDisabled.current = disabled;
  }, [disabled]);

  const canSubmit = !disabled && value.trim() !== "";

  return (
    <div
      ref={rootRef}
      className="sticky bottom-0 z-10 border-t border-hair bg-sheet px-3 py-3"
    >
      {status && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          {status}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // 日本語入力の変換を確定する Enter は無視する
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        disabled={disabled}
        rows={2}
        placeholder={placeholder}
        className="field block resize-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-primary"
        >
          答える
        </button>
        <button
          type="button"
          onClick={onDontKnow}
          disabled={disabled}
          className="btn"
        >
          分かりません
        </button>
        <span className="ml-auto hidden text-xs text-ink-3 sm:inline">
          Ctrl + Enter で送れます
        </span>
      </div>
    </div>
  );
}
