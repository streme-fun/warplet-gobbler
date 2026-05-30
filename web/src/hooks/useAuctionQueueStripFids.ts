"use client";

import { useMemo } from "react";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";

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
  const { configured, isError, auction } = useAuctionSellAuction();
  const queueReadsEnabled = configured && !isError;
  const liveTokenId =
    auction != null && auction.tokenId > 0n && !auction.settled
      ? auction.tokenId
      : undefined;
  const { data: chainQueuedIds = [], isLoading: queueLoading } =
    useAuctionSellQueue({
      enabled: queueReadsEnabled,
      excludeTokenId: liveTokenId,
    });

  return useMemo(() => {
    if (!queueReadsEnabled || queueLoading) {
      return [];
    }
    return dedupeFids(chainQueuedIds);
  }, [queueReadsEnabled, queueLoading, chainQueuedIds]);
}
