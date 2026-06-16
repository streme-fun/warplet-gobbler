"use client";

import { useMemo } from "react";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { useLegacyLockedQueueIds } from "@/hooks/useLegacyLockedQueue";

function dedupeFids(ids: bigint[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const id of ids) {
    const k = id.toString();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(Number(id));
  }
  return out;
}

/**
 * FIDs for parallax tiles — on-chain queue when reads succeed; empty while loading or unset (no mock art).
 * Keeps Parallax tiles aligned with the queue strip.
 */
export function useAuctionQueueStripFids(): number[] {
  const { configured, isError } = useAuctionSellAuction();
  const queueReadsEnabled = configured && !isError;
  const { data: chainQueuedIds = [], isLoading: queueLoading } =
    useAuctionSellQueue({
      enabled: queueReadsEnabled,
    });
  const { data: legacyLockedIds = [], isLoading: legacyLoading } =
    useLegacyLockedQueueIds({
      enabled: queueReadsEnabled,
      excludeTokenIds: chainQueuedIds,
    });

  return useMemo(() => {
    if (!queueReadsEnabled || queueLoading || legacyLoading) {
      return [];
    }
    return dedupeFids([...chainQueuedIds, ...legacyLockedIds]);
  }, [
    queueReadsEnabled,
    queueLoading,
    legacyLoading,
    chainQueuedIds,
    legacyLockedIds,
  ]);
}
