import { describe, it, expect } from "vitest";
import { formatSmartStreamNumber } from "./format-stream-number";

const OPTS = { minSigFigs: 6, hideDecimalsIfIntegerDigitsGt: 5 };

describe("formatSmartStreamNumber", () => {
  it("collapses long leading-zero runs into subscript notation", () => {
    expect(formatSmartStreamNumber(0.0000000000100283, OPTS)).toBe(
      "0.0₁₀100283",
    );
    expect(formatSmartStreamNumber(0.00000123, OPTS)).toBe("0.0₅123000");
    expect(formatSmartStreamNumber(-0.0000000000100283, OPTS)).toBe(
      "-0.0₁₀100283",
    );
  });

  it("uses two subscript digits for very long zero runs", () => {
    expect(formatSmartStreamNumber(1.5e-15, OPTS)).toBe("0.0₁₄150000");
  });

  it("keeps plain notation for short zero runs", () => {
    expect(formatSmartStreamNumber(0.000100283, OPTS)).toBe("0.000100283");
    expect(formatSmartStreamNumber(0.123456, OPTS)).toBe("0.123456");
  });

  it("does not compress values rounding up to 1", () => {
    expect(formatSmartStreamNumber(0.9999999, OPTS)).toBe("1.00000");
  });

  it("keeps existing behavior for larger numbers", () => {
    expect(formatSmartStreamNumber(0, OPTS)).toBe("0");
    expect(formatSmartStreamNumber(1234.5678, OPTS)).toBe("1,234.57");
    expect(formatSmartStreamNumber(1234567, OPTS)).toBe("1,234,567");
  });
});
