"use client";

import { useEffect, useRef } from "react";

/** Countdown timer — ticks every second via DOM writes.
 *  Supply either `startSecs` (relative countdown) or `endUnix` (absolute epoch seconds). */
export default function CountdownTimer({
  startSecs,
  endUnix,
  className,
}: {
  startSecs?: number;
  endUnix?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const initialSecs = endUnix != null
    ? Math.max(0, endUnix - Date.now() / 1000)
    : (startSecs ?? 0);

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      const remaining = Math.max(0, initialSecs - elapsed);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = Math.floor(remaining % 60);
      if (ref.current) {
        ref.current.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [initialSecs]);

  const h = Math.floor(initialSecs / 3600);
  const m = Math.floor((initialSecs % 3600) / 60);
  const s = Math.floor(initialSecs % 60);
  return (
    <span ref={ref} className={className}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </span>
  );
}
