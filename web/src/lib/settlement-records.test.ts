import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import {
  getWinnerFingerprint,
  mergeSettlementRecords,
  type SettlementRecord,
} from "./settlement-records";

const ALICE = "0x1111111111111111111111111111111111111111" as Address;
const BOB = "0x2222222222222222222222222222222222222222" as Address;

describe("getWinnerFingerprint", () => {
  it("uses the bare tokenId when no gobbled id is known", () => {
    expect(getWinnerFingerprint(42n, ALICE, 1000n)).toBe(`42-${ALICE}-1000`);
    expect(getWinnerFingerprint(42n, ALICE, 1000n, null)).toBe(
      `42-${ALICE}-1000`,
    );
    expect(getWinnerFingerprint(42n, ALICE, 1000n, undefined)).toBe(
      `42-${ALICE}-1000`,
    );
  });

  it("prefixes the gobbled id with `g` so it can't collide with a bare tokenId", () => {
    expect(getWinnerFingerprint(42n, ALICE, 1000n, 200000042n)).toBe(
      `g200000042-${ALICE}-1000`,
    );
    // string and bigint gobbled ids produce the same fingerprint
    expect(getWinnerFingerprint(42n, ALICE, 1000n, "200000042")).toBe(
      `g200000042-${ALICE}-1000`,
    );
  });

  it("distinguishes a known-receipt record from a legacy one for the same lot", () => {
    const legacy = getWinnerFingerprint(42n, ALICE, 1000n);
    const exact = getWinnerFingerprint(42n, ALICE, 1000n, 200000042n);
    expect(legacy).not.toBe(exact);
  });
});

function rec(over: Partial<SettlementRecord>): SettlementRecord {
  return {
    fp: "fp",
    tokenId: 42,
    bidder: ALICE,
    amountWei: "1000",
    recordedAt: 0,
    ...over,
  };
}

describe("mergeSettlementRecords", () => {
  it("returns an empty list for no input", () => {
    expect(mergeSettlementRecords([])).toEqual([]);
  });

  it("dedupes identical fingerprints, keeping the latest recordedAt", () => {
    const fp = getWinnerFingerprint(42n, ALICE, 1000n, 200000042n);
    const merged = mergeSettlementRecords([
      rec({ fp, gobbledTokenId: "200000042", recordedAt: 100 }),
      rec({ fp, gobbledTokenId: "200000042", recordedAt: 500 }),
      rec({ fp, gobbledTokenId: "200000042", recordedAt: 300 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].recordedAt).toBe(500);
  });

  it("drops a legacy (no gobbledTokenId) record when an exact one exists for the same lot", () => {
    const exactFp = getWinnerFingerprint(42n, ALICE, 1000n, 200000042n);
    const legacyFp = getWinnerFingerprint(42n, ALICE, 1000n);
    const merged = mergeSettlementRecords([
      rec({ fp: legacyFp, recordedAt: 10 }), // legacy, same lot
      rec({ fp: exactFp, gobbledTokenId: "200000042", recordedAt: 20 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].gobbledTokenId).toBe("200000042");
  });

  it("keeps a legacy record when no exact record covers that lot", () => {
    const legacyFp = getWinnerFingerprint(42n, ALICE, 1000n);
    const merged = mergeSettlementRecords([rec({ fp: legacyFp })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].gobbledTokenId).toBeUndefined();
  });

  it("treats lots as distinct across bidder and amount (same warplet tokenId)", () => {
    const a = getWinnerFingerprint(42n, ALICE, 1000n, 200000042n);
    const b = getWinnerFingerprint(42n, BOB, 1000n, 200000042n);
    const c = getWinnerFingerprint(42n, ALICE, 2000n, 200000042n);
    const merged = mergeSettlementRecords([
      rec({ fp: a, bidder: ALICE, amountWei: "1000", gobbledTokenId: "200000042" }),
      rec({ fp: b, bidder: BOB, amountWei: "1000", gobbledTokenId: "200000042" }),
      rec({ fp: c, bidder: ALICE, amountWei: "2000", gobbledTokenId: "200000042" }),
    ]);
    expect(merged).toHaveLength(3);
  });

  it("matches lots case-insensitively on bidder address when dropping legacy dupes", () => {
    const exactFp = getWinnerFingerprint(42n, ALICE, 1000n, 200000042n);
    const legacyFp = getWinnerFingerprint(42n, ALICE, 1000n);
    const merged = mergeSettlementRecords([
      // legacy record stored with an upper-cased address variant
      rec({
        fp: legacyFp,
        bidder: ALICE.toUpperCase() as Address,
        recordedAt: 10,
      }),
      rec({ fp: exactFp, gobbledTokenId: "200000042", recordedAt: 20 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].gobbledTokenId).toBe("200000042");
  });

  it("keeps multiple distinct receipts for the same warplet (re-gobbled lot)", () => {
    // Same warplet 42 auctioned twice → two different gobbled ids, different bidders.
    const first = getWinnerFingerprint(42n, ALICE, 1000n, 42n);
    const second = getWinnerFingerprint(42n, BOB, 3000n, 100000042n);
    const merged = mergeSettlementRecords([
      rec({ fp: first, bidder: ALICE, amountWei: "1000", gobbledTokenId: "42" }),
      rec({
        fp: second,
        bidder: BOB,
        amountWei: "3000",
        gobbledTokenId: "100000042",
      }),
    ]);
    expect(merged).toHaveLength(2);
  });
});
