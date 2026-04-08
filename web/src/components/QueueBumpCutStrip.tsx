"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Match `queue-bump-cut-sweep` + short tail so the blade finishes before refetch nudge. */
const CUT_MS = Math.round(500 * 1.2 * 1.2 * 0.9);

/**
 * Local overlay over the auction queue strip: horizontal “cut” blade + soft flash
 * after a successful skip-the-line tx. Calls onSequenceComplete when visuals end
 * (or almost immediately if prefers-reduced-motion).
 */
export default function QueueBumpCutStrip({
  active,
  onSequenceComplete,
}: {
  active: boolean;
  onSequenceComplete: () => void;
}) {
  const onCompleteRef = useRef(onSequenceComplete);
  onCompleteRef.current = onSequenceComplete;

  const [reducedMotion, setReducedMotion] = useState(false);

  useLayoutEffect(() => {
    if (!active) {
      setReducedMotion(false);
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduced);

    const ms = reduced ? 40 : CUT_MS;
    const t = window.setTimeout(() => onCompleteRef.current(), ms);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return null;

  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl"
      aria-hidden
    >
      <div className="queue-bump-strip-flash-bg absolute inset-0" />
      <div className="queue-bump-cut-sweep absolute top-[6%] bottom-[6%] w-[9px] sm:w-[10px] -translate-x-1/2 rounded-full queue-bump-cut-blade-gradient shadow-[0_0_24px_5px_rgba(0,245,255,0.32),0_0_48px_12px_rgba(123,97,255,0.22)]" />
    </div>
  );
}
