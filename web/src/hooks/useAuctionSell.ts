"use client";

import type { Address } from "viem";
import { formatUnits } from "viem";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";

export interface AuctionLot {
  tokenId: bigint;
  amount: bigint;
  bidder: Address;
  settled: boolean;
  endTime: bigint;
}

/**
 * Reads live AuctionSell lot when the contract is configured and wired.
 * Until then, returns `auction: null` so UI stays on mock data.
 */
export function useAuctionSellAuction() {
  const configured =
    CONTRACTS.auctionSell.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  return {
    configured,
    auction: null as AuctionLot | null,
    formatBidAmount: (amount: bigint) =>
      Number(formatUnits(amount, 18)).toLocaleString(undefined, {
        maximumFractionDigits: 6,
      }),
    bidSymbol: AUCTION_BID_TOKEN_SYMBOL,
    isError: false,
    skipQueueFeeAmountStr: null as string | null,
  };
}
