"use client";

import { useEffect, useRef, useState } from "react";

const DIM_BUILD_MS = 500;
/** Slash phase: simultaneous triple blades (duration + short tail). */
const SLASH_MS = 700;
const LIGHTEN_MS = 1100;

type Phase = "dim" | "slash" | "lighten";

/**
 * Full-screen bid feedback: darken over 0.5s → slash → slowly brighten.
 */
export default function BidFeedbackOverlay({
  active,
  onSequenceComplete,
}: {
  active: boolean;
  onSequenceComplete: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("dim");
  const onSequenceCompleteRef = useRef(onSequenceComplete);
  onSequenceCompleteRef.current = onSequenceComplete;

  useEffect(() => {
    if (!active) {
      setPhase("dim");
      return;
    }

    setPhase("dim");

    const tSlash = window.setTimeout(() => {
      setPhase("slash");
    }, DIM_BUILD_MS);

    const tLighten = window.setTimeout(() => {
      setPhase("lighten");
    }, DIM_BUILD_MS + SLASH_MS);

    const tDone = window.setTimeout(() => {
      onSequenceCompleteRef.current();
    }, DIM_BUILD_MS + SLASH_MS + LIGHTEN_MS);

    return () => {
      window.clearTimeout(tSlash);
      window.clearTimeout(tLighten);
      window.clearTimeout(tDone);
    };
    // Intentionally only `active`: a new `onSequenceComplete` identity must not
    // reset timers mid-sequence (felt like “first slash twice” / extra pass).
  }, [active]);

  if (!active) return null;

  const backdropClass =
    phase === "dim"
      ? "animate-bid-feedback-dim-build"
      : phase === "slash"
        ? "bid-feedback-backdrop-peak"
        : "animate-bid-feedback-dim-release";

  return (
    <div
      className="fixed inset-0 z-[55] pointer-events-none"
      aria-hidden
    >
      <div className={`absolute inset-0 bg-black ${backdropClass}`} />
      {phase === "slash" ? (
        <div
          className="absolute left-1/2 top-1/2 flex flex-col items-stretch gap-[88px] sm:gap-[96px] pointer-events-none w-[min(140vw,56rem)] sm:w-[min(130vw,48rem)]"
          style={{
            transform: "translate(-50%, -50%) rotate(-26deg)",
          }}
        >
          <div className="h-[3px] sm:h-[4px] w-full shrink-0 rounded-full bid-feedback-blade-gradient animate-bid-feedback-blade" />
          <div className="h-[3px] sm:h-[4px] w-full shrink-0 rounded-full bid-feedback-blade-gradient animate-bid-feedback-blade" />
          <div className="h-[3px] sm:h-[4px] w-full shrink-0 rounded-full bid-feedback-blade-gradient animate-bid-feedback-blade" />
        </div>
      ) : null}
    </div>
  );
}
