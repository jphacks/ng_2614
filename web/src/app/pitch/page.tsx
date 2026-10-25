"use client";

// ピッチ用の入口。資料の「先生モード」のスライドからリンクで開き、デモを用意してから判定結果（S-3）に移る

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { preparePitchDemo } from "@/lib/demo/pitch";

export default function PitchPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // 開発時の二重実行（React の StrictMode）で2回用意しないようにする
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    preparePitchDemo()
      .then((reviewId) => router.replace(`/reviews/${reviewId}`))
      .catch((e) => setError(e instanceof Error ? e.message : "デモを用意できませんでした。"));
  }, [router]);

  return error ? (
    <p role="alert" className="border-l-2 border-pen pl-3 text-sm text-pen">
      {error}
    </p>
  ) : (
    <p className="text-sm text-ink-3" role="status">
      デモを用意しています…
    </p>
  );
}
