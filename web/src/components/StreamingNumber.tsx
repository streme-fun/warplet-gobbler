"use client";

import { useEffect, useRef } from "react";
import { formatSmartStreamNumber } from "@/lib/format-stream-number";

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
    let raf = 0;
    function tick() {
      if (cancelled) return;
      const elapsed = (performance.now() - t0) / 1000;
      let val = start + elapsed * perSecond;
      if (min !== undefined && val < min) val = min;
      if (ref.current) {
        ref.current.textContent =
          smartOpts != null
            ? formatSmartStreamNumber(val, smartOpts)
            : formatFixed(val, decimals, min, truncateFractionDigits);
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

  let initialText: string;
  if (smartMinSigFigs != null) {
    let v = start;
    if (min !== undefined && v < min) v = min;
    initialText = formatSmartStreamNumber(v, {
      minSigFigs: smartMinSigFigs,
      hideDecimalsIfIntegerDigitsGt: smartHideDecimalsIfIntegerDigitsGt,
    });
  } else {
    initialText = formatFixed(start, decimals, min, truncateFractionDigits);
  }

  return (
    <span ref={ref} className={className}>
      {initialText}
    </span>
  );
}
