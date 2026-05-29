import { describe, it, expect } from "vitest";
import {
  parseOptionalGobbledTokenId,
  resolveReceiptTokenId,
} from "./gobbled-token-id";

const PADDING = 100_000_000n; // matches GobbledWarplets.WARPLET_ID_PADDING

describe("parseOptionalGobbledTokenId", () => {
  it("treats null/undefined/empty string as absent", () => {
    expect(parseOptionalGobbledTokenId(null)).toBeUndefined();
    expect(parseOptionalGobbledTokenId(undefined)).toBeUndefined();
    expect(parseOptionalGobbledTokenId("")).toBeUndefined();
  });

  it("parses decimal strings and numbers", () => {
    expect(parseOptionalGobbledTokenId("0")).toBe(0n);
    expect(parseOptionalGobbledTokenId("100000042")).toBe(100_000_042n);
    expect(parseOptionalGobbledTokenId(42)).toBe(42n);
  });

  it("parses values beyond Number.MAX_SAFE_INTEGER when given as a string", () => {
    const big = "100000000000000000042"; // > 2^53
    expect(parseOptionalGobbledTokenId(big)).toBe(BigInt(big));
  });

  it("rejects non-integer / non-decimal junk", () => {
    expect(() => parseOptionalGobbledTokenId("12.5")).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() => parseOptionalGobbledTokenId("-5")).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() => parseOptionalGobbledTokenId("0x10")).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() => parseOptionalGobbledTokenId("abc")).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() => parseOptionalGobbledTokenId("1e9")).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() => parseOptionalGobbledTokenId(" 5 ")).toThrow(
      "Invalid gobbledTokenId",
    );
  });

  it("rejects unsafe / fractional numbers", () => {
    expect(() => parseOptionalGobbledTokenId(1.5)).toThrow(
      "Invalid gobbledTokenId",
    );
    expect(() =>
      parseOptionalGobbledTokenId(Number.MAX_SAFE_INTEGER + 1),
    ).toThrow("Invalid gobbledTokenId");
  });
});

describe("resolveReceiptTokenId — requested id path", () => {
  // warplet 42 has been gobbled 3 times → reserved indices 0,1,2.
  const base = { warpletId: 42n, padding: PADDING, gobbleCount: 3n };

  it("echoes a valid requested id (index 0)", () => {
    const requested = 0n * PADDING + 42n;
    expect(
      resolveReceiptTokenId({ ...base, requestedGobbledTokenId: requested }),
    ).toBe(requested);
  });

  it("echoes the latest reserved index (gobbleCount - 1)", () => {
    const requested = 2n * PADDING + 42n;
    expect(
      resolveReceiptTokenId({ ...base, requestedGobbledTokenId: requested }),
    ).toBe(requested);
  });

  it("rejects an id whose warplet component doesn't match", () => {
    const wrongWarplet = 1n * PADDING + 43n; // decodes to warplet 43, not 42
    expect(() =>
      resolveReceiptTokenId({ ...base, requestedGobbledTokenId: wrongWarplet }),
    ).toThrow("does not match warpletId");
  });

  it("rejects an index at or beyond gobbleCount (no reservation yet)", () => {
    const notYetReserved = 3n * PADDING + 42n; // index 3, only 0..2 exist
    expect(() =>
      resolveReceiptTokenId({
        ...base,
        requestedGobbledTokenId: notYetReserved,
      }),
    ).toThrow("No reservation exists for this gobbledTokenId");
  });

  it("rejects a negative requested id", () => {
    expect(() =>
      resolveReceiptTokenId({ ...base, requestedGobbledTokenId: -1n }),
    ).toThrow("Invalid gobbledTokenId");
  });

  it("accepts warpletId 0 encoded at a valid index", () => {
    const requested = 1n * PADDING + 0n;
    expect(
      resolveReceiptTokenId({
        warpletId: 0n,
        padding: PADDING,
        gobbleCount: 2n,
        requestedGobbledTokenId: requested,
      }),
    ).toBe(requested);
  });
});

describe("resolveReceiptTokenId — fallback path (no requested id)", () => {
  it("returns the most recent reservation: (gobbleCount - 1) * padding + warpletId", () => {
    expect(
      resolveReceiptTokenId({ warpletId: 42n, padding: PADDING, gobbleCount: 3n }),
    ).toBe(2n * PADDING + 42n);
  });

  it("returns index 0 encoding when gobbled exactly once", () => {
    expect(
      resolveReceiptTokenId({ warpletId: 7n, padding: PADDING, gobbleCount: 1n }),
    ).toBe(7n);
  });

  it("throws when the warplet has never been gobbled", () => {
    expect(() =>
      resolveReceiptTokenId({ warpletId: 7n, padding: PADDING, gobbleCount: 0n }),
    ).toThrow("No reservation exists for this warplet");
  });

  it("returns the index-0 encoding for warpletId 0 on the fallback path", () => {
    expect(
      resolveReceiptTokenId({ warpletId: 0n, padding: PADDING, gobbleCount: 1n }),
    ).toBe(0n);
  });

  it("throws a distinct error (not a RangeError) when padding is 0", () => {
    expect(() =>
      resolveReceiptTokenId({ warpletId: 42n, padding: 0n, gobbleCount: 3n }),
    ).toThrow("WARPLET_ID_PADDING");
    // also on the requested-id path
    expect(() =>
      resolveReceiptTokenId({
        warpletId: 42n,
        padding: 0n,
        gobbleCount: 3n,
        requestedGobbledTokenId: 42n,
      }),
    ).toThrow("WARPLET_ID_PADDING");
  });
});
