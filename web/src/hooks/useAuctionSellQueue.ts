"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { auctionSellAbi } from "@/abi/auctionSell";

export function useAuctionSellQueue(opts: { enabled: boolean }) {
  const configured =
    CONTRACTS.auctionSell.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  const q = useReadContract({
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "getQueuedTokenIds",
    query: {
      enabled: configured && opts.enabled,
      refetchInterval: 5_000,
    },
  });

  return {
    data: (q.data ?? []) as bigint[],
    isError: q.isError,
    refetch: q.refetch,
  };
}
