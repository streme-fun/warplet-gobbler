import { describe, expect, it } from "vitest";
import { zeroAddress, type Address } from "viem";
import {
  classifyLegacyAuctionState,
  classifyLegacyHeldWarplets,
  legacyAuctionStatusLabel,
  legacyMinNextBidWei,
  type LegacyCurrentAuction,
} from "./legacy-auction";

const BIDDER = "0x1111111111111111111111111111111111111111" as Address;

function auction(
  overrides: Partial<LegacyCurrentAuction> = {},
): LegacyCurrentAuction {
  return {
    tokenId: 421769n,
    highBidder: zeroAddress,
    highBid: 0n,
    endTime: 2_000n,
    ...overrides,
  };
}

describe("classifyLegacyAuctionState", () => {
  it("marks a live no-bid auction as biddable", () => {
    expect(
      classifyLegacyAuctionState({
        auction: auction(),
        paused: false,
        nowUnix: 1_000,
      }),
    ).toMatchObject({
      status: "live-no-bids",
      canBid: true,
      canSettleAndStartNext: false,
      canExtend: false,
    });
  });

  it("marks an ended auction with bids as settle/start ready", () => {
    expect(
      classifyLegacyAuctionState({
        auction: auction({ highBidder: BIDDER, highBid: 100n }),
        paused: false,
        nowUnix: 2_001,
      }),
    ).toMatchObject({
      status: "ended-with-bids",
      ended: true,
      canBid: false,
      canSettleAndStartNext: true,
      canExtend: false,
    });
  });

  it("marks an ended auction without bids as extend ready", () => {
    expect(
      classifyLegacyAuctionState({
        auction: auction(),
        paused: false,
        nowUnix: 2_001,
      }),
    ).toMatchObject({
      status: "ended-without-bids",
      ended: true,
      canBid: false,
      canSettleAndStartNext: false,
      canExtend: true,
    });
  });

  it("blocks actions while paused", () => {
    expect(
      classifyLegacyAuctionState({
        auction: auction({ highBidder: BIDDER, highBid: 100n }),
        paused: true,
        nowUnix: 2_001,
      }),
    ).toMatchObject({
      status: "paused",
      ended: true,
      canBid: false,
      canSettleAndStartNext: false,
      canExtend: false,
    });
  });

  it("handles no current auction", () => {
    expect(
      classifyLegacyAuctionState({
        auction: auction({ tokenId: 0n }),
        paused: false,
        nowUnix: 1_000,
      }),
    ).toMatchObject({
      status: "no-current-auction",
      hasCurrentAuction: false,
      canBid: false,
    });
  });
});

describe("classifyLegacyHeldWarplets", () => {
  it("flags held tokens as current, queued, or rescue-check", () => {
    expect(
      classifyLegacyHeldWarplets({
        heldTokenIds: [420499n, 421769n, 249800n, 266221n],
        currentTokenId: 421769n,
        queuedTokenIds: [266221n, 249800n],
      }),
    ).toEqual([
      { tokenId: 420499n, status: "held-needs-rescue-check" },
      { tokenId: 421769n, status: "current" },
      { tokenId: 249800n, status: "queued" },
      { tokenId: 266221n, status: "queued" },
    ]);
  });
});

describe("legacyMinNextBidWei", () => {
  it("uses reserve price before any bid", () => {
    expect(legacyMinNextBidWei(0n, 1_000n, 10)).toBe(1_000n);
  });

  it("adds the configured increment to the current high bid", () => {
    expect(legacyMinNextBidWei(1_000n, 500n, 10)).toBe(1_100n);
  });
});

describe("legacyAuctionStatusLabel", () => {
  it("uses the explicit no-bid live auction wording", () => {
    expect(legacyAuctionStatusLabel("live-no-bids")).toBe(
      "Live auction / no bids / can bid",
    );
  });
});
