"use client";

import ShareCastButton from "@/components/ShareCastButton";
import { claimCastText, claimShareUrl } from "@/lib/share/share-links";

/**
 * Appears after a winner claims (rescues) their gobbled Warplet — the receipt
 * NFT with the AI ooze art is the most screenshot-able artifact in the system,
 * so give it a one-tap path into the feed.
 */
export default function ClaimShareStrip({
  warpletId,
  onDismiss,
}: {
  warpletId: number;
  onDismiss: () => void;
}) {
  return (
    <div className="relative flex w-full max-w-sm items-center gap-2 overflow-hidden rounded-md border border-accent/30 bg-accent/10 py-1.5 pl-2.5 pr-8 text-[11px] leading-none">
      <span className="shrink-0">🖤</span>
      <span className="min-w-0 flex-1 truncate text-base-content/80">
        Warplet #{warpletId} survived. Show off the ooze.
      </span>
      <ShareCastButton
        className="btn-accent btn-xs h-6 min-h-0 shrink-0 px-2 py-0 text-[10px] uppercase tracking-wide"
        label="Share"
        buildPayload={(viewerFid) => ({
          text: claimCastText({ warpletId }),
          embeds: [claimShareUrl(warpletId, { ref: viewerFid })],
        })}
      />
      <button
        type="button"
        onClick={onDismiss}
        className="btn btn-ghost btn-xs absolute right-0.5 top-1/2 h-6 w-6 min-h-0 -translate-y-1/2 p-0 text-base-content/35 hover:text-base-content/70"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
