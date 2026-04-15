"use client";

import { useMemo } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { CONTRACTS } from "@/lib/contracts";
import { auctionSellAbi } from "@/abi/auctionSell";

export function useAuctionSellQueue(opts: {
  enabled: boolean;
  excludeTokenId?: bigint;
}) {
  const configured = !isAddressEqual(CONTRACTS.auctionSell, zeroAddress);

  const q = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: CONTRACTS.auctionSell,
    functionName: "getQueuedTokenIds",
    query: {
      enabled: configured && opts.enabled,
      refetchInterval: 5_000,
    },
  });

  const data = useMemo(() => {
    const raw = q.data ?? [];
    if (!raw.length) return [] as bigint[];
    const ex = opts.excludeTokenId;
    if (ex === undefined) return [...raw];
    return raw.filter((id) => id !== ex);
  }, [q.data, opts.excludeTokenId]);

  return {
    data,
    isError: q.isError,
    refetch: q.refetch,
    isLoading: q.isLoading,
  };
}
