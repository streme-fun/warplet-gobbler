import { describe, it, expect } from "vitest";
import {
  formatCompactAmount,
  formatCompactWei,
  formatUsdLabel,
} from "./format-amount";

describe("formatCompactAmount", () => {
  it("scales through K/M/B with 3 significant figures", () => {
    expect(formatCompactAmount(2_412_345.67)).toBe("2.41M");
    expect(formatCompactAmount(12_400)).toBe("12.4K");
    expect(formatCompactAmount(123_400)).toBe("123K");
    expect(formatCompactAmount(1_240_000_000)).toBe("1.24B");
  });

  it("keeps small amounts plain", () => {
    expect(formatCompactAmount(999.5)).toBe("999.5");
    expect(formatCompactAmount(0.5)).toBe("0.5");
  });

  it("never crashes on degenerate inputs", () => {
    expect(formatCompactAmount(0)).toBe("0");
    expect(formatCompactAmount(-5)).toBe("0");
    expect(formatCompactAmount(NaN)).toBe("0");
    expect(formatCompactAmount(Infinity)).toBe("0");
  });
});

describe("formatCompactWei", () => {
  it("applies token decimals before compacting", () => {
    expect(formatCompactWei(2_500_000n * 10n ** 18n, 18)).toBe("2.50M");
    expect(formatCompactWei(1_500_000n, 6)).toBe("1.5");
  });
});

describe("formatUsdLabel", () => {
  it("rounds whole dollars above $100 and keeps cents below", () => {
    expect(formatUsdLabel(1234.56)).toBe("~$1,235");
    expect(formatUsdLabel(12.345)).toBe("~$12.35");
  });

  it("returns null when no quote is available", () => {
    expect(formatUsdLabel(null)).toBeNull();
    expect(formatUsdLabel(0)).toBeNull();
  });
});
