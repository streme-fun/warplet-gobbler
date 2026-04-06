"use client";

import { useCallback, useMemo } from "react";
import { formatUnits, parseUnits, type Address, isAddressEqual, zeroAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { auctionSellAbi } from "@/abi/auctionSell";
import { erc777Abi } from "@/abi/erc777";
import { CONTRACTS } from "@/lib/contracts";
import type { AuctionSellLot } from "@/hooks/useAuctionSell";

export function minNextBidWei(
  currentBid: bigint,
  reservePrice: bigint,
  minIncrementPct: number,
): bigint {
  if (currentBid === 0n) return reservePrice;
  return currentBid + (currentBid * BigInt(minIncrementPct)) / 100n;
}

export function useAuctionSellBid(opts: {
  enabled: boolean;
  lot: AuctionSellLot | null;
  bidTokenAddress: Address | undefined;
  bidDecimals: number;
  refetchAuction: () => Promise<unknown>;
}) {
  const {
    enabled: bidFlowEnabled,
    lot,
    bidTokenAddress,
    bidDecimals,
    refetchAuction,
  } = opts;
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const tokenReady =
    bidTokenAddress != null && !isAddressEqual(bidTokenAddress, zeroAddress);

  const configured = bidFlowEnabled && tokenReady;

  const reserveQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "reservePrice",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const minPctQ = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "minBidIncrementPercentage",
    query: { enabled: configured, refetchInterval: 30_000 },
  });

  const minBidWei = useMemo(() => {
    if (!lot || !configured) return null;
    const reserve = reserveQ.data;
    const pct = minPctQ.data;
    if (reserve === undefined || pct === undefined) return null;
    return minNextBidWei(lot.amount, reserve, Number(pct));
  }, [lot, configured, reserveQ.data, minPctQ.data]);

  const minBidHuman =
    minBidWei != null ? formatUnits(minBidWei, bidDecimals) : null;

  const placeBid = useCallback(
    async (amountWei: bigint) => {
      if (
        !bidTokenAddress ||
        address == null ||
        minBidWei == null ||
        amountWei < minBidWei
      ) {
        throw new Error("Invalid bid amount");
      }
      const hash = await writeContractAsync({
        abi: erc777Abi,
        address: bidTokenAddress,
        functionName: "send",
        args: [CONTRACTS.auctionSell, amountWei, "0x"],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAuction();
    },
    [address, bidTokenAddress, minBidWei, publicClient, refetchAuction, writeContractAsync],
  );

  const parseHumanToWei = useCallback(
    (human: string): bigint => parseUnits(human.trim() || "0", bidDecimals),
    [bidDecimals],
  );

  return {
    minBidWei,
    minBidHuman,
    reservePriceWei: reserveQ.data,
    placeBid,
    parseHumanToWei,
    isBidding: isWritePending,
    rulesLoading: reserveQ.isLoading || minPctQ.isLoading,
  };
}
