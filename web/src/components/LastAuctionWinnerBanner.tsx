"use client";

/* eslint-disable @next/next/no-img-element */

import type { Address } from "viem";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";
import type { RescueStage } from "@/hooks/useGobbledRescue";

const STORAGE_KEY = "wg:last-auction-winner-dismissed";
/** Snapshot of the lot that just settled — on-chain `auction` may already be the *next* live lot. */
const HIGHLIGHT_KEY = "wg:last-auction-winner-highlight";

export type StoredWinnerHighlight = {
  fp: string;
  tokenId: number;
  bidder: Address;
  amountWei: string;
};

export function getWinnerFingerprint(
  tokenId: bigint,
  bidder: Address,
  amountWei: bigint,
): string {
  return `${tokenId}-${bidder}-${amountWei}`;
}

function rescueStageLabel(stage: RescueStage): string {
  switch (stage) {
    case "preparing":
      return "Preparing metadata…";
    case "awaiting-wallet":
      return "Confirm in wallet…";
    case "confirming":
      return "Submitting…";
    case "success":
      return "Claimed!";
    default:
      return "Claim Warplet";
  }
}

export type ClaimAction = {
  /** True only when the connected viewer is the winner of the last settled auction. */
  visible: boolean;
  stage: RescueStage;
  error: string | null;
  onClaim: () => void;
};

export default function LastAuctionWinnerBanner({
  tokenId,
  winnerAddress,
  winAmountLabel,
  bidSymbol,
  viewerAddress,
  onDismiss,
  claim,
}: {
  tokenId: number;
  winnerAddress: Address;
  winAmountLabel: string;
  bidSymbol: string;
  viewerAddress?: Address | null;
  onDismiss: () => void;
  claim?: ClaimAction;
}) {
  const claimBusy =
    claim?.stage === "preparing" ||
    claim?.stage === "awaiting-wallet" ||
    claim?.stage === "confirming";
  const claimDone = claim?.stage === "success";

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
        {claim?.visible ? (
          <div className="flex flex-col items-stretch sm:items-end gap-1 border-t sm:border-t-0 sm:border-l border-base-content/10 pt-3 sm:pt-0 sm:pl-6">
            <button
              type="button"
              onClick={claim.onClaim}
              disabled={claimBusy || claimDone}
              className="btn btn-success btn-sm whitespace-nowrap"
            >
              {claimBusy ? (
                <span className="loading loading-spinner loading-xs mr-2" />
              ) : null}
              {rescueStageLabel(claim.stage)}
            </button>
            {claim.error ? (
              <p className="text-xs text-error text-right max-w-[14rem] break-words">
                {claim.error}
              </p>
            ) : null}
          </div>
        ) : null}
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

export function readWinnerHighlight(): StoredWinnerHighlight | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HIGHLIGHT_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<StoredWinnerHighlight>;
    if (
      typeof o.fp !== "string" ||
      typeof o.tokenId !== "number" ||
      typeof o.bidder !== "string" ||
      typeof o.amountWei !== "string"
    ) {
      return null;
    }
    return {
      fp: o.fp,
      tokenId: o.tokenId,
      bidder: o.bidder as Address,
      amountWei: o.amountWei,
    };
  } catch {
    return null;
  }
}

export function writeWinnerHighlight(h: StoredWinnerHighlight) {
  try {
    localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

export function clearWinnerHighlight() {
  try {
    localStorage.removeItem(HIGHLIGHT_KEY);
  } catch {
    /* ignore */
  }
}
