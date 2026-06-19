import { describe, expect, it } from "vitest";
import { normalizePaymentTokenSymbol } from "./paymentToken";

describe("normalizePaymentTokenSymbol", () => {
  it("falls back from stale LARPBOBB env labels to WARPGOBB", () => {
    expect(normalizePaymentTokenSymbol("LARPBOBB")).toBe("WARPGOBB");
    expect(normalizePaymentTokenSymbol("larpbobb")).toBe("WARPGOBB");
  });

  it("preserves current and custom token symbols", () => {
    expect(normalizePaymentTokenSymbol("WARPGOBB")).toBe("WARPGOBB");
    expect(normalizePaymentTokenSymbol("SUP", "WARPGOBB")).toBe("SUP");
  });

  it("uses the caller fallback for missing values", () => {
    expect(normalizePaymentTokenSymbol("", "WARPGOBB")).toBe("WARPGOBB");
    expect(normalizePaymentTokenSymbol(undefined, "WARPGOBB")).toBe(
      "WARPGOBB",
    );
  });
});
