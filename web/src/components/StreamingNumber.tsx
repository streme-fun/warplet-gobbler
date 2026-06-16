"use client";

import { useEffect, useRef } from "react";
import { formatSmartStreamNumber } from "@/lib/format-stream-number";
import { chaseStreamValue } from "@/lib/stream-display";

type StreamingNumberProps = {
  start: number;
  perSecond: number;
  /** Fixed decimal places when not using smart formatting */
  decimals?: number;
  /**
   * When set (with `smartHideDecimalsIfIntegerDigitsGt`), format for at least this many
   * significant figures and drop decimals for large whole numbers.
   */
  smartMinSigFigs?: number;
  smartHideDecimalsIfIntegerDigitsGt?: number;
  /** Floor value — number won't go below this */
  min?: number;
  /**
   * When using fixed `decimals`, chop fractional part (toward zero) before formatting.
   * Typical for USD: `decimals={2} truncateFractionDigits` shows at most cents, never rounds up.
   */
  truncateFractionDigits?: boolean;
  className?: string;
};

function formatFixed(
  val: number,
  decimals: number,
  min?: number,
  truncateFractionDigits?: boolean,
) {
  let v = val;
  if (min !== undefined && v < min) v = min;
  if (truncateFractionDigits && decimals > 0) {
    const f = 10 ** decimals;
    v = Math.trunc(v * f) / f;
  }
  const [whole, frac] = v.toFixed(decimals).split(".");
  const formatted = Number(whole).toLocaleString("en-US");
  return frac ? `${formatted}.${frac}` : formatted;
}

export default function StreamingNumber({
  start,
  perSecond,
  decimals = 8,
  smartMinSigFigs,
  smartHideDecimalsIfIntegerDigitsGt = 5,
  min,
  truncateFractionDigits,
  className,
}: StreamingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayRef = useRef<number | null>(null);

  useEffect(() => {
    const useSmart = smartMinSigFigs != null;
    const smartOpts = useSmart
      ? {
          minSigFigs: smartMinSigFigs,
          hideDecimalsIfIntegerDigitsGt: smartHideDecimalsIfIntegerDigitsGt,
        }
      : null;

    let cancelled = false;
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    function tick(now: number) {
      if (cancelled) return;
      const elapsed = (now - t0) / 1000;
      let target = start + elapsed * perSecond;
      if (min !== undefined && target < min) target = min;
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;

      let display = chaseStreamValue(
        displayRef.current ?? target,
        target,
        perSecond,
        dt,
      );
      if (min !== undefined && display < min) display = min;
      displayRef.current = display;

      if (ref.current) {
        ref.current.textContent =
          smartOpts != null
            ? formatSmartStreamNumber(display, smartOpts)
            : formatFixed(display, decimals, min, truncateFractionDigits);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    start,
    perSecond,
    decimals,
    min,
    smartMinSigFigs,
    smartHideDecimalsIfIntegerDigitsGt,
    truncateFractionDigits,
  ]);

  // Freeze the first-paint text: after mount the rAF loop owns the node, and a
  // React re-render rewriting it with a freshly computed value would snap the count.
  const initialTextRef = useRef<string | null>(null);
  if (initialTextRef.current === null) {
    if (smartMinSigFigs != null) {
      let v = start;
      if (min !== undefined && v < min) v = min;
      initialTextRef.current = formatSmartStreamNumber(v, {
        minSigFigs: smartMinSigFigs,
        hideDecimalsIfIntegerDigitsGt: smartHideDecimalsIfIntegerDigitsGt,
      });
    } else {
      initialTextRef.current = formatFixed(
        start,
        decimals,
        min,
        truncateFractionDigits,
      );
    }
  }

  return (
    <span ref={ref} className={className}>
      {initialTextRef.current}
    </span>
  );
}
