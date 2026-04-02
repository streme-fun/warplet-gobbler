"use client";

import { useMemo } from "react";
import { MOCK_AUCTIONS } from "@/lib/mock-data";

/**
 * FIDs in the auction *queue* row (everything after the live lot in `MOCK_AUCTIONS`).
 * Parallax uses these so background tiles reuse the same `/api/warplet-image/*` URLs as the queue UI.
 *
 * When `useAuctionSellAuction` / on-chain queue is wired in GobblerAuctionSection, mirror that source here
 * so parallax stays in sync with the strip.
 */
export function useAuctionQueueStripFids(): number[] {
  return useMemo(() => MOCK_AUCTIONS.slice(1).map((a) => a.fid), []);
}
