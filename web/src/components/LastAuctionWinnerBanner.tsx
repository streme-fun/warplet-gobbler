"use client";

/* eslint-disable @next/next/no-img-element */

import type { Address } from "viem";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";

const STORAGE_KEY = "wg:last-auction-winner-dismissed";

export function getWinnerFingerprint(
  tokenId: bigint,
  bidder: Address,
  amountWei: bigint,
): string {
  return `${tokenId}-${bidder}-${amountWei}`;
}

export default function LastAuctionWinnerBanner({
  tokenId,
  winnerAddress,
  winAmountLabel,
  bidSymbol,
  viewerAddress,
  onDismiss,
}: {
  tokenId: number;
  winnerAddress: Address;
  winAmountLabel: string;
  bidSymbol: string;
  viewerAddress?: Address | null;
  onDismiss: () => void;
}) {
  return (
    <div className="relative w-full max-w-4xl rounded-xl border border-success/25 bg-success/5 px-4 py-4 sm:px-5 sm:py-4 mb-6 pr-12 sm:pr-14">
      <button
        type="button"
        onClick={onDismiss}
        className="btn btn-ghost btn-sm btn-circle absolute top-3 right-3 text-base-content/40 hover:text-base-content/80"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-success/90 mb-3">
        Last auction
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-base-content/10 shrink-0">
            <AuctionWarpletImage fid={tokenId} variant="thumb" />
          </div>
          <div>
            <p className="text-xs text-base-content/50 uppercase tracking-wide">
              Won Warplet
            </p>
            <p className="text-sm font-medium text-base-content">#{tokenId}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-base-content/10 pt-3 sm:pt-0 sm:pl-6">
          <p className="text-xs text-base-content/50 uppercase tracking-wide mb-1.5">
            Winner
          </p>
          <BidderAvatarName
            address={winnerAddress}
            viewerAddress={viewerAddress ?? undefined}
          />
          <p className="text-xs text-base-content/45 mt-2 font-mono tabular-nums">
            Winning bid: {winAmountLabel}{" "}
            <span className="text-base-content/35">{bidSymbol}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function readDismissedWinnerFp(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeDismissedWinnerFp(fp: string) {
  try {
    localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    /* ignore */
  }
}
