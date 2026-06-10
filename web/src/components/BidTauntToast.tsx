"use client";

import { useEffect } from "react";
import ShareCastButton from "@/components/ShareCastButton";
import { appUrl } from "@/lib/miniapp-embed";
import { bidCastText } from "@/lib/share/share-links";

const AUTO_DISMISS_MS = 25_000;

/**
 * Slim bottom toast after a bid lands: taunting the timeline invites
 * counter-bids, and counter-bids are the auction's whole engine.
 */
export default function BidTauntToast({
  tokenId,
  amountLabel,
  symbol,
  onDismiss,
}: {
  tokenId: number;
  amountLabel: string;
  symbol: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-20 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-secondary/40 bg-base-200/95 backdrop-blur-md py-2 pl-4 pr-2 shadow-lg shadow-secondary/20">
        <span className="text-xs sm:text-sm text-base-content/80">
          Your bid is in. Taunt the timeline —
        </span>
        <ShareCastButton
          className="btn-secondary btn-xs sm:btn-sm rounded-full"
          label="Cast it"
          buildPayload={(viewerFid) => {
            const embed = new URL("/buy", appUrl);
            if (viewerFid != null) {
              embed.searchParams.set("ref", String(viewerFid));
            }
            return {
              text: bidCastText({ tokenId, amountLabel, symbol }),
              embeds: [embed.toString()],
            };
          }}
          onShared={onDismiss}
        />
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost btn-xs h-7 w-7 min-h-0 p-0 text-base-content/40"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
