"use client";

import { isAddressEqual, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { auctionSellAbi } from "@/abi/auctionSell";

export function useAuctionSellQueue(opts: { enabled: boolean }) {
  const configured = !isAddressEqual(CONTRACTS.auctionSell, zeroAddress);

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
