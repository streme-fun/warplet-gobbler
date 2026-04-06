"use client";

import { useEffect, useRef } from "react";

function formatHms(totalSecs: number) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  return {
    text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    h,
    m,
    s,
  };
}

/** Countdown timer — ticks via rAF; wall-clock `endUnix` or duration `startSecs` from mount. */
export default function CountdownTimer({
  startSecs = 0,
  endUnix,
  className,
}: {
  /** Seconds remaining, counting down from first paint (relative). */
  startSecs?: number;
  /** Unix seconds when the countdown hits zero (absolute). */
  endUnix?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    function tick() {
      const remaining =
        endUnix !== undefined
          ? Math.max(0, endUnix - Math.floor(Date.now() / 1000))
          : Math.max(0, startSecs - (performance.now() - t0) / 1000);
      const { text } = formatHms(remaining);
      if (ref.current) ref.current.textContent = text;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startSecs, endUnix]);

  const initialSecs =
    endUnix !== undefined
      ? Math.max(0, endUnix - Math.floor(Date.now() / 1000))
      : startSecs;
  const { h, m, s } = formatHms(initialSecs);
  return (
    <span ref={ref} className={className}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </span>
  );
}
