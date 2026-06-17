"use client";

import { useMemo } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";
import {
  LEGACY_MIGRATION_PENDING_QUEUE_IDS,
  legacyMigrationConfigured,
} from "@/lib/legacy-migration";

function filterExcluded(
  ids: readonly bigint[],
  exclude: ReadonlySet<string>,
): bigint[] {
  const out: bigint[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const key = id.toString();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Warplets still held on legacy `AuctionSell` — shown in the queue strip until ops
 * `safeTransfer`s them to the new contract tail.
 *
 * When legacy env vars are unset (post cutover), falls back to
 * `LEGACY_MIGRATION_PENDING_QUEUE_IDS` and drops each id once it appears on the
 * new contract queue.
 */
export function useLegacyLockedQueueIds(opts: {
  enabled: boolean;
  excludeTokenIds?: readonly bigint[];
}) {
  const legacyConfigured = legacyMigrationConfigured();
  const legacyAddress = CONTRACTS.auctionSellLegacy;
  const onChainEnabled =
    opts.enabled && legacyConfigured && !isAddressEqual(legacyAddress, zeroAddress);

  const queueQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: legacyAddress,
    functionName: "getQueuedTokenIds",
    query: {
      enabled: onChainEnabled,
      refetchInterval: 15_000,
    },
  });

  const auctionQ = useReadContract({
    chainId: base.id,
    abi: auctionSellAbi,
    address: legacyAddress,
    functionName: "auction",
    query: {
      enabled: onChainEnabled,
      refetchInterval: 15_000,
    },
  });

  const data = useMemo(() => {
    if (!opts.enabled) return [] as bigint[];
    const exclude = new Set(
      (opts.excludeTokenIds ?? []).map((id) => id.toString()),
    );

    if (onChainEnabled) {
      const queued = queueQ.data ?? [];
      const live =
        auctionQ.data != null && auctionQ.data.tokenId > 0n
          ? [auctionQ.data.tokenId]
          : [];
      return filterExcluded([...live, ...queued], exclude);
    }

    return filterExcluded(LEGACY_MIGRATION_PENDING_QUEUE_IDS, exclude);
  }, [
    opts.enabled,
    onChainEnabled,
    queueQ.data,
    auctionQ.data,
    opts.excludeTokenIds,
  ]);

  return {
    data,
    isLoading: onChainEnabled && (queueQ.isLoading || auctionQ.isLoading),
    refetch: async () => {
      if (!onChainEnabled) return;
      await Promise.all([queueQ.refetch(), auctionQ.refetch()]);
    },
  };
}
