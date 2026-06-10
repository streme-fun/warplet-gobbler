import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  claimableHoldings,
  classifyHeldWarplet,
  latestReceiptId,
  settlementRecordsForClaimableHoldings,
  type ClaimableHolding,
} from "./claimable-holdings";
import { getWinnerFingerprint, type SettlementRecord } from "./settlement-records";

const PADDING = 100_000_000n;
const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;

function rec(over: {
  tokenId: number;
  gobbledTokenId?: string;
  bidder?: Address;
  amountWei?: string;
}): SettlementRecord {
  const bidder = over.bidder ?? VIEWER;
  const amountWei = over.amountWei ?? "1000";
  return {
    fp: getWinnerFingerprint(
      BigInt(over.tokenId),
      bidder,
      BigInt(amountWei),
      over.gobbledTokenId,
    ),
    tokenId: over.tokenId,
    gobbledTokenId: over.gobbledTokenId,
    bidder,
    amountWei,
    recordedAt: 1,
  };
}

describe("latestReceiptId", () => {
  it("computes the latest receipt id from gobbleCount - 1", () => {
    expect(
      latestReceiptId({
        warpletId: 884_860n,
        gobbleCount: 2n,
        padding: PADDING,
      }),
    ).toBe(100_884_860n);
  });

  it("returns null for a held warplet with no reservation", () => {
    expect(
      latestReceiptId({ warpletId: 884_860n, gobbleCount: 0n, padding: PADDING }),
    ).toBeNull();
  });
});

describe("classifyHeldWarplet", () => {
  it("excludes the live auction token", () => {
    expect(
      classifyHeldWarplet({
        warpletId: 901_147n,
        gobbleCount: 1n,
        padding: PADDING,
        warpletRescued: false,
        liveAuctionTokenId: 901_147n,
      }),
    ).toEqual({ status: "live-auction", warpletId: 901_147n });
  });

  it("excludes rescued receipts", () => {
    expect(
      classifyHeldWarplet({
        warpletId: 901_147n,
        gobbleCount: 1n,
        padding: PADDING,
        warpletRescued: true,
      }),
    ).toEqual({ status: "rescued", warpletId: 901_147n, receiptId: 901_147n });
  });

  it("keeps held, unrescued receipts", () => {
    expect(
      classifyHeldWarplet({
        warpletId: 901_147n,
        gobbleCount: 1n,
        padding: PADDING,
        warpletRescued: false,
      }),
    ).toEqual({
      status: "claimable",
      warpletId: 901_147n,
      receiptId: 901_147n,
    });
  });

  it("surfaces gobbleCount 0 as never-gobbled, not claimable", () => {
    const classified = classifyHeldWarplet({
      warpletId: 901_147n,
      gobbleCount: 0n,
      padding: PADDING,
      warpletRescued: false,
    });
    expect(classified).toEqual({
      status: "never-gobbled",
      warpletId: 901_147n,
    });
    expect(claimableHoldings([classified])).toEqual([]);
  });

  it("returns an empty claimable set for empty holdings", () => {
    expect(claimableHoldings([])).toEqual([]);
  });
});

describe("settlementRecordsForClaimableHoldings", () => {
  const holdings: ClaimableHolding[] = [
    { warpletId: 901_147n, receiptId: 901_147n },
    { warpletId: 884_860n, receiptId: 100_884_860n },
  ];

  it("joins claimable holdings to exact resolved winner records", () => {
    const out = settlementRecordsForClaimableHoldings(holdings, [
      rec({ tokenId: 901_147, gobbledTokenId: "901147" }),
      rec({ tokenId: 884_860, gobbledTokenId: "100884860" }),
    ]);

    expect(out.map((r) => r.gobbledTokenId).sort()).toEqual([
      "100884860",
      "901147",
    ]);
  });

  it("does not join records without a matching receipt id", () => {
    expect(
      settlementRecordsForClaimableHoldings(holdings, [
        rec({ tokenId: 901_147 }),
        rec({ tokenId: 999_999, gobbledTokenId: "999999" }),
      ]),
    ).toEqual([]);
  });

  it("does not join a matching receipt id when the displayed Warplet id is wrong", () => {
    expect(
      settlementRecordsForClaimableHoldings(holdings, [
        rec({ tokenId: 999_999, gobbledTokenId: "901147" }),
      ]),
    ).toEqual([]);
  });

  it("lets callers filter the joined records to the connected viewer", () => {
    const out = settlementRecordsForClaimableHoldings(holdings, [
      rec({ tokenId: 901_147, gobbledTokenId: "901147", bidder: OTHER }),
      rec({ tokenId: 884_860, gobbledTokenId: "100884860", bidder: VIEWER }),
    ]);

    expect(out.filter((r) => r.bidder === VIEWER).map((r) => r.tokenId)).toEqual(
      [884_860],
    );
  });

  it("keeps an exact freshly-settled record while holdings reads are stale", () => {
    const fresh = rec({ tokenId: 901_147, gobbledTokenId: "901147" });

    expect(
      settlementRecordsForClaimableHoldings([], [fresh], {
        freshRecords: [fresh],
      }),
    ).toEqual([fresh]);
  });

  it("does not bridge freshly-settled records without an exact receipt id", () => {
    const freshLegacy = rec({ tokenId: 901_147 });

    expect(
      settlementRecordsForClaimableHoldings([], [freshLegacy], {
        freshRecords: [freshLegacy],
      }),
    ).toEqual([]);
  });

  it("dedupes a fresh bridge once holdings reads catch up", () => {
    const fresh = rec({ tokenId: 901_147, gobbledTokenId: "901147" });

    expect(
      settlementRecordsForClaimableHoldings(
        [{ warpletId: 901_147n, receiptId: 901_147n }],
        [fresh],
        { freshRecords: [fresh] },
      ),
    ).toEqual([fresh]);
  });
});
