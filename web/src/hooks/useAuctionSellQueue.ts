"use client";

/**
 * On-chain token ids waiting in the exit queue (excluding the live lot).
 * Stub returns empty until `AuctionSell` queue reads are implemented.
 */
export function useAuctionSellQueue(_opts: {
  enabled: boolean;
  excludeTokenId?: bigint;
}) {
  return { data: [] as bigint[] };
}
