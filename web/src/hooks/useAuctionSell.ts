"use client";

import { useMemo } from "react";
import { formatUnits, type Address, isAddressEqual, zeroAddress } from "viem";
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

/** Matches `AuctionSell._bid` min-bid rule (floor + increment %). */
export function minBidForAuction(
  currentHighBid: bigint,
  reservePrice: bigint,
  minBidIncrementPercentage: number,
): bigint {
  if (currentHighBid === 0n) return reservePrice;
  return (
    currentHighBid +
    (currentHighBid * BigInt(minBidIncrementPercentage)) / 100n
  );
}

/**
 * Reads AuctionSell when `NEXT_PUBLIC_AUCTION_SELL_ADDRESS` is set.
 * Full queue bump + ERC777 `send` path matches `feat/auction-linked-list-queue`; older ABIs fail reads → mocks in UI.
 */
export function useAuctionSellAuction() {
  const configured = !isAddressEqual(CONTRACTS.auctionSell, zeroAddress);

  const auctionQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "auction",
    query: {
      enabled: configured,
      refetchInterval: 5_000,
    },
  });

  const refetchAuction = auctionQ.refetch;

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

  const reserveQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "reservePrice",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const incrementPctQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "minBidIncrementPercentage",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const pausedQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "paused",
    query: {
      enabled: configured,
      refetchInterval: 12_000,
    },
  });

  const stremeZapQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "stremeZap",
    query: { enabled: configured, refetchInterval: 60_000 },
  });

  const bidTokenAddr =
    typeof bidTokenQ.data === "string" &&
    !isAddressEqual(bidTokenQ.data as Address, zeroAddress)
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
    const d = auctionQ.data;
    if (d == null) return null;
    if (Array.isArray(d)) {
      const [tokenId, amount, startTime, endTime, bidder, settled] = d;
      return { tokenId, amount, startTime, endTime, bidder, settled };
    }
    return {
      tokenId: d.tokenId,
      amount: d.amount,
      startTime: d.startTime,
      endTime: d.endTime,
      bidder: d.bidder,
      settled: d.settled,
    };
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

  const minNextBidAmount = useMemo(() => {
    if (!chainLot || chainLot.settled) return null;
    if (reserveQ.data === undefined || incrementPctQ.data === undefined) {
      return null;
    }
    return minBidForAuction(
      chainLot.amount,
      reserveQ.data,
      Number(incrementPctQ.data),
    );
  }, [chainLot, reserveQ.data, incrementPctQ.data]);

  const isPaused = pausedQ.data === true;

  const stremeZapAddr =
    stremeZapQ.isSuccess &&
    typeof stremeZapQ.data === "string" &&
    !isAddressEqual(stremeZapQ.data as Address, zeroAddress)
      ? (stremeZapQ.data as Address)
      : undefined;

  const nativeEthBidConfigured = stremeZapAddr != null;

  return {
    configured,
    auction: chainLot,
    bidDecimals: decimals,
    decimals,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    skipQueueFeeAmountStr,
    queueBumpFeeWei: bumpFeeQ.data,
    queueBumpReady,
    bidTokenAddress: bidTokenAddr,
    auctionPaused: isPaused,
    isPaused,
    minNextBidAmount,
    reservePrice: reserveQ.data,
    refetchAuction,
    stremeZapAddress: stremeZapAddr,
    nativeEthBidConfigured,
  };
}
