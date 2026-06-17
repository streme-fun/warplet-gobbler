"use client";

import { useMemo } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";
import { legacyMigrationConfigured } from "@/lib/legacy-migration";

/**
 * Warplets still held on legacy `AuctionSell` — shown in the queue strip until ops
 * `safeTransfer`s them to the new contract tail.
 */
export function useLegacyLockedQueueIds(opts: {
  enabled: boolean;
  excludeTokenIds?: readonly bigint[];
}) {
  const legacyConfigured = legacyMigrationConfigured();
  const legacyAddress = CONTRACTS.auctionSellLegacy;
  const readsEnabled = opts.enabled && legacyConfigured;

  const queueQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: legacyAddress,
    functionName: "getQueuedTokenIds",
    query: {
      enabled: readsEnabled && !isAddressEqual(legacyAddress, zeroAddress),
      refetchInterval: 15_000,
    },
  });

  const auctionQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: legacyAddress,
    functionName: "auction",
    query: {
      enabled: readsEnabled && !isAddressEqual(legacyAddress, zeroAddress),
      refetchInterval: 15_000,
    },
  });

  const data = useMemo(() => {
    if (!readsEnabled) return [] as bigint[];
    const exclude = new Set(
      (opts.excludeTokenIds ?? []).map((id) => id.toString()),
    );
    const queued = queueQ.data ?? [];
    const live =
      auctionQ.data != null && auctionQ.data.tokenId > 0n
        ? [auctionQ.data.tokenId]
        : [];
    const merged: bigint[] = [];
    const seen = new Set<string>();
    for (const id of [...live, ...queued]) {
      const key = id.toString();
      if (seen.has(key) || exclude.has(key)) continue;
      seen.add(key);
      merged.push(id);
    }
    return merged;
  }, [
    readsEnabled,
    queueQ.data,
    auctionQ.data,
    opts.excludeTokenIds,
  ]);

  return {
    data,
    isLoading: queueQ.isLoading || auctionQ.isLoading,
    refetch: async () => {
      await Promise.all([queueQ.refetch(), auctionQ.refetch()]);
    },
  };
}
