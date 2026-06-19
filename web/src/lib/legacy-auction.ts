import { isAddressEqual, zeroAddress, type Address } from "viem";

export const LEGACY_AUCTION_SELL_ADDRESS =
  "0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9" as Address;
export const LEGACY_GOBBLED_WARPLETS_ADDRESS =
  "0x2159d7AAfA7CC6cBFf49B1ab9BD353c7e0d1d10b" as Address;
export const LEGACY_WARPLETS_ADDRESS =
  "0x699727F9E01A822EFdcf7333073f0461e5914b4E" as Address;
export const LEGACY_WARPGOBB_TOKEN_ADDRESS =
  "0x1A339C38Ae22726F1A4235bCecf8f12aebE4C5E8" as Address;

export type LegacyCurrentAuction = {
  tokenId: bigint;
  highBidder: Address;
  highBid: bigint;
  endTime: bigint;
};

export type LegacyAuctionStatus =
  | "paused"
  | "no-current-auction"
  | "live-no-bids"
  | "live-with-bids"
  | "ended-with-bids"
  | "ended-without-bids";

export type LegacyAuctionState = {
  status: LegacyAuctionStatus;
  hasCurrentAuction: boolean;
  hasBids: boolean;
  ended: boolean;
  canBid: boolean;
  canSettleAndStartNext: boolean;
  canExtend: boolean;
};

export type LegacyHeldWarpletStatus =
  | "current"
  | "queued"
  | "held-needs-rescue-check";

export type LegacyHeldWarplet = {
  tokenId: bigint;
  status: LegacyHeldWarpletStatus;
};

export function legacyMinNextBidWei(
  currentBid: bigint,
  reservePrice: bigint,
  minIncrementPct: number,
): bigint {
  if (currentBid === 0n) return reservePrice;
  return currentBid + (currentBid * BigInt(minIncrementPct)) / 100n;
}

export function classifyLegacyAuctionState({
  auction,
  paused,
  nowUnix,
}: {
  auction: LegacyCurrentAuction | null;
  paused: boolean;
  nowUnix: number;
}): LegacyAuctionState {
  const hasCurrentAuction = auction != null && auction.tokenId > 0n;
  const hasBids =
    auction != null &&
    auction.highBid > 0n &&
    !isAddressEqual(auction.highBidder, zeroAddress);
  const ended =
    hasCurrentAuction &&
    auction.endTime > 0n &&
    BigInt(nowUnix) >= auction.endTime;

  if (paused) {
    return {
      status: "paused",
      hasCurrentAuction,
      hasBids,
      ended,
      canBid: false,
      canSettleAndStartNext: false,
      canExtend: false,
    };
  }

  if (!hasCurrentAuction) {
    return {
      status: "no-current-auction",
      hasCurrentAuction: false,
      hasBids: false,
      ended: false,
      canBid: false,
      canSettleAndStartNext: false,
      canExtend: false,
    };
  }

  if (ended && hasBids) {
    return {
      status: "ended-with-bids",
      hasCurrentAuction,
      hasBids,
      ended,
      canBid: false,
      canSettleAndStartNext: true,
      canExtend: false,
    };
  }

  if (ended && !hasBids) {
    return {
      status: "ended-without-bids",
      hasCurrentAuction,
      hasBids,
      ended,
      canBid: false,
      canSettleAndStartNext: false,
      canExtend: true,
    };
  }

  return {
    status: hasBids ? "live-with-bids" : "live-no-bids",
    hasCurrentAuction,
    hasBids,
    ended: false,
    canBid: true,
    canSettleAndStartNext: false,
    canExtend: false,
  };
}

export function classifyLegacyHeldWarplets({
  heldTokenIds,
  currentTokenId,
  queuedTokenIds,
}: {
  heldTokenIds: readonly bigint[];
  currentTokenId: bigint | null;
  queuedTokenIds: readonly bigint[];
}): LegacyHeldWarplet[] {
  const queued = new Set(queuedTokenIds.map((id) => id.toString()));

  return heldTokenIds.map((tokenId) => {
    if (currentTokenId != null && tokenId === currentTokenId) {
      return { tokenId, status: "current" };
    }
    if (queued.has(tokenId.toString())) {
      return { tokenId, status: "queued" };
    }
    return { tokenId, status: "held-needs-rescue-check" };
  });
}

export function legacyAuctionStatusLabel(status: LegacyAuctionStatus): string {
  switch (status) {
    case "paused":
      return "Paused";
    case "no-current-auction":
      return "No current auction";
    case "live-no-bids":
      return "Live auction / no bids / can bid";
    case "live-with-bids":
      return "Live auction / bid open";
    case "ended-with-bids":
      return "Ended with bids / settle and start next";
    case "ended-without-bids":
      return "Ended without bids / can extend";
  }
}
