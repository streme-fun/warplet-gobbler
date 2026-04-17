"use client";

import { useMemo } from "react";
import { formatUnits, type Address, isAddressEqual, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
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
    currentHighBid + (currentHighBid * BigInt(minBidIncrementPercentage)) / 100n
  );
}

/**
 * Reads AuctionSell when `NEXT_PUBLIC_AUCTION_SELL_ADDRESS` is set.
 * Full queue bump + ERC777 `send` path matches `feat/auction-linked-list-queue`; older ABIs fail reads → mocks in UI.
 */
export function useAuctionSellAuction() {
  const configured = !isAddressEqual(CONTRACTS.auctionSell, zeroAddress);

  const auctionQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "auction",
    query: {
      enabled: configured,
      refetchInterval: 5_000,
    },
  });

  const refetchAuction = auctionQ.refetch;

  const currentAuctionQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "currentAuction",
    query: {
      enabled: configured,
      refetchInterval: 5_000,
    },
  });

  const bumpFeeQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "queueBumpFee",
    query: {
      enabled: configured,
      refetchInterval: 15_000,
    },
  });

  const bidTokenQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "bidToken",
    query: {
      enabled: configured,
      refetchInterval: 60_000,
    },
  });

  const reserveQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "reservePrice",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const incrementPctQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "minBidIncrementPercentage",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const pausedQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "paused",
    query: {
      enabled: configured,
      refetchInterval: 12_000,
    },
  });

  const stremeZapQ = useReadContract({
    chainId: base.id,
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
    chainId: base.id,
    abi: erc20Abi,
    address: bidTokenAddr ?? ZERO_ADDRESS,
    functionName: "decimals",
    query: { enabled: !!bidTokenAddr },
  });

  const symbolQ = useReadContract({
    chainId: base.id,
    abi: erc20Abi,
    address: bidTokenAddr ?? ZERO_ADDRESS,
    functionName: "symbol",
    query: { enabled: !!bidTokenAddr },
  });

  const currentLiveTokenId = useMemo((): bigint | null => {
    const d = currentAuctionQ.data;
    if (d == null) return null;
    return d[0];
  }, [currentAuctionQ.data]);

  /**
   * Shape the raw `auction()` read into our `AuctionSellLot` type.
   *
   * viem decodes the tuple as either an array or an object depending on ABI
   * component naming; we handle both. `auction()` still provides the canonical
   * lot details (tokenId, amount, bidder, timers). We derive `settled` from
   * `currentAuction()`: when it reports `tokenId == 0`, the currently stored
   * lot has been settled and no live lot is running.
   */
  const chainLot: AuctionSellLot | null = useMemo(() => {
    const d = auctionQ.data;
    if (d == null) return null;
    if (Array.isArray(d)) {
      const [tokenId, amount, startTime, endTime, bidder] = d;
      const settled =
        amount > 0n &&
        currentAuctionQ.isSuccess &&
        currentLiveTokenId === 0n &&
        tokenId > 0n;
      return { tokenId, amount, startTime, endTime, bidder, settled };
    }
    const settled =
      d.amount > 0n &&
      currentAuctionQ.isSuccess &&
      currentLiveTokenId === 0n &&
      d.tokenId > 0n;
    return {
      tokenId: d.tokenId,
      amount: d.amount,
      startTime: d.startTime,
      endTime: d.endTime,
      bidder: d.bidder,
      settled,
    };
  }, [auctionQ.data, currentAuctionQ.isSuccess, currentLiveTokenId]);

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

  const isAuctionLoading =
    configured && (auctionQ.isPending || auctionQ.isLoading);

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
    isAuctionLoading,
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
