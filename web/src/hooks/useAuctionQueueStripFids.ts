"use client";

import { useMemo } from "react";
import { MOCK_AUCTIONS } from "@/lib/mock-data";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";

/**
 * FIDs in the auction queue row — on-chain order when AuctionSell reads succeed, else `MOCK_AUCTIONS` tail.
 * Keeps Parallax tiles aligned with the queue strip.
 */
export function useAuctionQueueStripFids(): number[] {
  const { configured, isError } = useAuctionSellAuction();
  const queueReadsEnabled = configured && !isError;
  const { data: chainQueuedIds = [] } = useAuctionSellQueue({
    enabled: queueReadsEnabled,
  });

  return useMemo(() => {
    if (queueReadsEnabled) {
      return chainQueuedIds.map((id) => Number(id));
    }
    return MOCK_AUCTIONS.slice(1).map((a) => a.fid);
  }, [queueReadsEnabled, chainQueuedIds]);
}
