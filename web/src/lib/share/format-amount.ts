import { formatUnits } from "viem";

/**
 * Compact human label for big token amounts: 2_412_345.67 → "2.41M".
 * Below 1K falls back to a plain locale string with up to 2 decimals —
 * share copy and OG images need glanceable numbers, not precision.
 */
export function formatCompactAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const tiers = [
    { floor: 1e9, suffix: "B" },
    { floor: 1e6, suffix: "M" },
    { floor: 1e3, suffix: "K" },
  ];
  for (const { floor, suffix } of tiers) {
    if (value >= floor) {
      const scaled = value / floor;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${suffix}`;
    }
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatCompactWei(wei: bigint, decimals: number): string {
  return formatCompactAmount(Number(formatUnits(wei, decimals)));
}

/** "~$1,234" style USD label; null when no quote is available. */
export function formatUsdLabel(usd: number | null): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return `~$${usd.toLocaleString("en-US", {
    maximumFractionDigits: usd >= 100 ? 0 : 2,
  })}`;
}
