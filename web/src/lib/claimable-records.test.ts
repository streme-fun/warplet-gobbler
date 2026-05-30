import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import {
  dropRescuedRecords,
  gobbledTokenIdsToReconcile,
} from "./claimable-records";
import type { SettlementRecord } from "./settlement-records";

const MC = "0x0C65BE17E86BCB6019148be0a4E8F0A4510A70CB" as Address;

function rec(
  tokenId: number,
  gobbledTokenId: string | undefined,
  amountWei: string,
): SettlementRecord {
  return {
    fp:
      gobbledTokenId == null
        ? `${tokenId}-${MC}-${amountWei}`
        : `g${gobbledTokenId}-${MC}-${amountWei}`,
    tokenId,
    gobbledTokenId,
    bidder: MC,
    amountWei,
    recordedAt: 1_700_000_000_000,
  };
}

// Mirrors the real markcarey state: two already-claimed higher-bid lots plus a
// genuinely-unclaimed lot that they actually need to claim.
const CLAIMED_HIGH = rec(1010523, "1010523", "1331000000000000000000000");
const UNCLAIMED = rec(1229079, "1229079", "1210000000000000000000000");
const RE_GOBBLED_UNCLAIMED = rec(884860, "100884860", "1000000000000000000000000");

describe("gobbledTokenIdsToReconcile", () => {
  it("returns unique receipt ids, skipping records without one", () => {
    const ids = gobbledTokenIdsToReconcile([
      CLAIMED_HIGH,
      UNCLAIMED,
      RE_GOBBLED_UNCLAIMED,
      rec(331916, undefined, "5"),
      rec(331916, "", "6"),
    ]);
    expect(ids.sort()).toEqual(["100884860", "1010523", "1229079"].sort());
  });

  it("dedupes repeated receipt ids", () => {
    expect(gobbledTokenIdsToReconcile([UNCLAIMED, UNCLAIMED])).toEqual([
      "1229079",
    ]);
  });
});

describe("dropRescuedRecords", () => {
  it("removes records whose receipt is rescued on-chain", () => {
    const out = dropRescuedRecords(
      [CLAIMED_HIGH, UNCLAIMED, RE_GOBBLED_UNCLAIMED],
      new Set(["1010523"]),
    );
    expect(out.map((r) => r.tokenId)).toEqual([1229079, 884860]);
  });

  it("is a no-op when nothing is rescued", () => {
    const input = [CLAIMED_HIGH, UNCLAIMED];
    expect(dropRescuedRecords(input, new Set())).toEqual(input);
  });

  it("keeps records lacking a gobbledTokenId (cannot reconcile)", () => {
    const fallback = rec(1229079, undefined, "1210000000000000000000000");
    const out = dropRescuedRecords([fallback], new Set(["1229079"]));
    expect(out).toEqual([fallback]);
  });

  it("lets the unclaimed lot win focus once claimed lots are dropped", () => {
    // sort-by-bid would pick CLAIMED_HIGH (1.331M); after reconciliation the
    // highest *remaining* is the genuinely-unclaimed UNCLAIMED (1.21M).
    const reconciled = dropRescuedRecords(
      [CLAIMED_HIGH, UNCLAIMED, RE_GOBBLED_UNCLAIMED],
      new Set(["1010523", "1046029"]),
    );
    const topByBid = [...reconciled].sort((a, b) =>
      BigInt(b.amountWei) > BigInt(a.amountWei) ? 1 : -1,
    )[0];
    expect(topByBid.tokenId).toBe(1229079);
  });
});
