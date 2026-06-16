/** Digits in floor(abs(n)); 0 if |n| < 1 (purely fractional). */
function countIntegerDigits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const int = Math.floor(Math.abs(n));
  if (int === 0) return 0;
  return String(int).length;
}

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

/** Leading-zero runs at or above this length collapse to 0.0₍ₙ₎ notation. */
const COMPRESS_ZERO_RUN_AT = 4;

function subscriptCount(count: number): string {
  return String(count)
    .split("")
    .map((c) => SUBSCRIPT_DIGITS[Number(c)])
    .join("");
}

/**
 * At least `minSigFigs` significant figures. No decimals when the integer part
 * has more than `hideDecimalsIfIntegerDigitsGt` digits. Fewest fractional digits
 * needed to hit the sig-fig target (via toPrecision), preserving locale grouping.
 */
export function formatSmartStreamNumber(
  n: number,
  opts: {
    minSigFigs: number;
    hideDecimalsIfIntegerDigitsGt: number;
  },
): string {
  const { minSigFigs, hideDecimalsIfIntegerDigitsGt } = opts;
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";

  const sig = minSigFigs;
  const intDig = countIntegerDigits(n);
  if (intDig > hideDecimalsIfIntegerDigitsGt) {
    return Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  const neg = n < 0;
  const abs = Math.abs(n);

  // Tiny fractions: collapse the run of leading zeros into a subscript count
  // so the string stays narrow at any magnitude: 0.000000000010028 → 0.0₁₀10028
  if (intDig === 0) {
    const [mantissa, expPart] = abs.toExponential(sig - 1).split("e");
    const zeroRun = -Number(expPart) - 1;
    if (zeroRun >= COMPRESS_ZERO_RUN_AT) {
      const digits = mantissa.replace(".", "");
      return `${neg ? "-" : ""}0.0${subscriptCount(zeroRun)}${digits}`;
    }
  }

  const precStr = abs.toPrecision(sig);

  if (/e/i.test(precStr)) {
    const num = Number(precStr) * (neg ? -1 : 1);
    return num.toLocaleString("en-US", {
      maximumSignificantDigits: sig,
      minimumSignificantDigits: 1,
    });
  }

  const [wholeRaw, fracRaw = ""] = precStr.split(".");
  const wholeNum = Number(wholeRaw);
  const wholeLocale = wholeNum.toLocaleString("en-US");
  const frac = fracRaw;
  const body = frac.length ? `${wholeLocale}.${frac}` : wholeLocale;
  return neg ? `-${body}` : body;
}
