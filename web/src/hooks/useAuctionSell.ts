"use client";

import { useMemo } from "react";
import { formatUnits, type Address } from "viem";
import { useReadContract } from "wagmi";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { auctionSellAbi } from "@/abi/auctionSell";
import { erc20Abi } from "@/abi/erc20";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";

export type AuctionSellLot = {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  endTime: bigint;
  bidder: Address;
  settled: boolean;
};

/**
 * Reads AuctionSell when `NEXT_PUBLIC_AUCTION_SELL_ADDRESS` is set.
 * Full queue bump + ERC777 `send` path matches `feat/auction-linked-list-queue`; older ABIs fail reads → mocks in UI.
 */
export function useAuctionSellAuction() {
  const configured =
    CONTRACTS.auctionSell.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  const auctionQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "auction",
    query: {
      enabled: configured,
      refetchInterval: 5_000,
    },
  });

  const bumpFeeQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "queueBumpFee",
    query: {
      enabled: configured,
      refetchInterval: 15_000,
    },
  });

  const bidTokenQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "bidToken",
    query: {
      enabled: configured,
      refetchInterval: 60_000,
    },
  });

  const bidTokenAddr =
    typeof bidTokenQ.data === "string" &&
    bidTokenQ.data.toLowerCase() !== ZERO_ADDRESS
      ? (bidTokenQ.data as Address)
      : undefined;

  const decimalsQ = useReadContract({
    abi: erc20Abi,
    address: bidTokenAddr ?? ZERO_ADDRESS,
    functionName: "decimals",
    query: { enabled: !!bidTokenAddr },
  });

  const symbolQ = useReadContract({
    abi: erc20Abi,
    address: bidTokenAddr ?? ZERO_ADDRESS,
    functionName: "symbol",
    query: { enabled: !!bidTokenAddr },
  });

  const chainLot: AuctionSellLot | null = useMemo(() => {
    if (!auctionQ.data) return null;
    const [tokenId, amount, startTime, endTime, bidder, settled] =
      auctionQ.data;
    return { tokenId, amount, startTime, endTime, bidder, settled };
  }, [auctionQ.data]);

  const auctionReadError = auctionQ.isError;

  const decimals = Number(decimalsQ.data ?? 18);

  const formatBidAmount = (amount: bigint) =>
    Number(formatUnits(amount, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });

  const bidSymbol = symbolQ.data ?? AUCTION_BID_TOKEN_SYMBOL;

  const skipQueueFeeAmountStr =
    bumpFeeQ.data != null && bumpFeeQ.isSuccess
      ? formatBidAmount(bumpFeeQ.data)
      : null;

  const queueBumpReady =
    bumpFeeQ.isSuccess &&
    bumpFeeQ.data != null &&
    bumpFeeQ.data > 0n &&
    bidTokenAddr != null;

  return {
    configured,
    auction: chainLot,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    skipQueueFeeAmountStr,
    queueBumpFeeWei: bumpFeeQ.data,
    queueBumpReady,
    bidTokenAddress: bidTokenAddr,
  };
}
