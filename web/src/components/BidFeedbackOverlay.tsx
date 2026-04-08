"use client";

import { useEffect, useRef, useState } from "react";

const DIM_BUILD_MS = 500;
const WAVE_MS = 900;
const LIGHTEN_MS = 1100;

type Phase = "dim" | "wave" | "lighten";

/**
 * Full-screen bid feedback: darken over 0.5s → gobbler lip wave → slowly brighten.
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

    const tWave = window.setTimeout(() => {
      setPhase("wave");
      window.dispatchEvent(new CustomEvent("gobbler:lip-wave"));
    }, DIM_BUILD_MS);

    const tLighten = window.setTimeout(() => {
      setPhase("lighten");
    }, DIM_BUILD_MS + WAVE_MS);

    const tDone = window.setTimeout(
      () => {
        onSequenceCompleteRef.current();
      },
      DIM_BUILD_MS + WAVE_MS + LIGHTEN_MS,
    );

    return () => {
      window.clearTimeout(tWave);
      window.clearTimeout(tLighten);
      window.clearTimeout(tDone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback via onSequenceCompleteRef only
  }, [active]);

  if (!active) return null;

  const backdropClass =
    phase === "dim"
      ? "animate-bid-feedback-dim-build"
      : phase === "wave"
        ? "bid-feedback-backdrop-peak"
        : "animate-bid-feedback-dim-release";

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none" aria-hidden>
      <div className={`absolute inset-0 bg-black ${backdropClass}`} />
    </div>
  );
}
