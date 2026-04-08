"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";

/** Wraps one queue-strip tile so shuffle nudge + stagger delay apply consistently. */
export default function QueueStripCellChrome({
  shuffleVersion,
  slotIndex,
  className = "",
  children,
}: {
  shuffleVersion: number;
  slotIndex: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (shuffleVersion === 0) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-queue-strip-nudge");
    void el.getBoundingClientRect();
    el.classList.add("animate-queue-strip-nudge");
  }, [shuffleVersion]);

  const style: CSSProperties | undefined =
    shuffleVersion > 0
      ? {
          ["--queue-nudge-delay" as string]: `${Math.round(
            slotIndex * 68 * 1.2 * 1.2 * 0.9,
          )}ms`,
        }
      : undefined;

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}
