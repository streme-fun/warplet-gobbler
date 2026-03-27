"use client";

import { useEffect, useRef } from "react";

/** Streaming number — updates every frame via direct DOM writes, no re-renders. */
export default function StreamingNumber({
  start,
  perSecond,
  decimals = 8,
  min,
  className,
}: {
  start: number;
  perSecond: number;
  decimals?: number;
  /** Floor value — number won't go below this */
  min?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      let val = start + elapsed * perSecond;
      if (min !== undefined && val < min) val = min;
      if (ref.current) {
        const [whole, frac] = val.toFixed(decimals).split(".");
        const formatted = Number(whole).toLocaleString("en-US");
        ref.current.textContent = frac ? `${formatted}.${frac}` : formatted;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, perSecond, decimals]);

  const initial = start.toFixed(decimals);
  const [w, f] = initial.split(".");
  return (
    <span ref={ref} className={className}>
      {Number(w).toLocaleString("en-US")}{f ? `.${f}` : ""}
    </span>
  );
}
