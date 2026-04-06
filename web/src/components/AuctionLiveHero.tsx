"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import type { Address } from "viem";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";
import CountdownTimer from "./CountdownTimer";

function AuctionBundleMini() {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 w-full">
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0 max-w-[4.5rem]">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-base-content/10">
          <img
            src="/warplet.png"
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <span className="text-[8px] sm:text-[9px] text-base-content/45 text-center leading-none">
          Warplet
        </span>
      </div>
      <span className="text-base-content/25 text-xs pb-4">+</span>
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0 max-w-[4.5rem]">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-base-content/10">
          <img
            src="/gobbled-warplet.jpg"
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <span className="text-[8px] sm:text-[9px] text-base-content/45 text-center leading-none">
          Gobbled
        </span>
      </div>
      <span className="text-base-content/25 text-xs pb-4">+</span>
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0 max-w-[4.5rem]">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-base-content/10">
          <img
            src="/sup.png"
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
          />
        </div>
        <span className="text-[8px] sm:text-[9px] text-base-content/45 text-center leading-none">
          $SUP
        </span>
      </div>
    </div>
  );
}

function formatBidHuman(amountStr: string) {
  const n = Number.parseFloat(amountStr);
  if (!Number.isFinite(n)) return amountStr;
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function AuctionLiveHero({
  displayTokenId,
  topBidAmountStr,
  bidSymbol,
  topBidder,
  viewerAddress,
  showNoBids,
  countdownEndUnix,
  countdownDurationSecs,
  auctionSettled,
  viewerIsLeadingBidder,
  bidDisabled,
  onBid,
}: {
  displayTokenId: number;
  topBidAmountStr: string;
  bidSymbol: string;
  topBidder: Address | null;
  viewerAddress?: Address | null;
  showNoBids: boolean;
  countdownEndUnix?: number;
  countdownDurationSecs?: number;
  auctionSettled: boolean;
  viewerIsLeadingBidder?: boolean;
  bidDisabled?: boolean;
  onBid?: (fid: number) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleBid = () => {
    if (bidDisabled || auctionSettled || !onBid) return;
    onBid(displayTokenId);
  };

  const sold = auctionSettled;
  const hasHighBidder =
    topBidder != null && !isAddressEqual(topBidder, zeroAddress);

  return (
    <div className="rounded-2xl border border-secondary/35 bg-gradient-to-b from-secondary/15 to-base-200/30 p-5 sm:p-8 shadow-[0_0_40px_-12px_rgba(123,97,255,0.45)]">
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-10">
        <div className="flex-shrink-0 mx-auto lg:mx-0 w-full max-w-[220px] sm:max-w-[260px] flex flex-col items-center">
          <div className="auction-warplet-aura w-full rounded-xl">
            <AuctionWarpletImage fid={displayTokenId} variant="hero" />
          </div>
          <AuctionBundleMini />
        </div>

        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-3 sm:gap-4 min-w-0">
          <div>
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-secondary mb-1">
              Today&apos;s auction
            </p>
            <p className="text-sm text-base-content/55">
              Every day, one Warplet is rescued. Bid to make them yours.
            </p>
          </div>

          <span className="inline-flex text-xs sm:text-sm px-2.5 py-1 rounded-full border border-base-content/15 text-base-content/65">
            Warplet #{displayTokenId}
          </span>

          <div className="w-full rounded-xl bg-base-100/30 border border-base-content/10 px-4 py-3 sm:py-4 space-y-3">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                Top bid
              </p>
              {sold ? (
                <p className="text-xl sm:text-2xl font-mono text-success">
                  Settled
                </p>
              ) : showNoBids ? (
                <p className="text-lg sm:text-xl font-mono text-base-content/50">
                  No bids yet
                </p>
              ) : (
                <p className="text-xl sm:text-2xl font-mono text-base-content tabular-nums">
                  {formatBidHuman(topBidAmountStr)}{" "}
                  <span className="text-base-content/40 text-lg sm:text-xl">
                    {bidSymbol}
                  </span>
                </p>
              )}
            </div>
            {!sold && viewerIsLeadingBidder && (
              <p className="text-xs sm:text-sm text-success/85 font-medium">
                You&apos;re the top bidder — the lot is still open until the
                timer ends.
              </p>
            )}
            {!sold && !showNoBids && hasHighBidder && topBidder && (
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1.5">
                  High bidder
                </p>
                <BidderAvatarName
                  address={topBidder}
                  viewerAddress={viewerAddress ?? undefined}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-base-content/50">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/40">
              Lot ends in
            </span>
            {countdownEndUnix !== undefined ? (
              <CountdownTimer
                endUnix={countdownEndUnix}
                className="font-mono text-secondary tabular-nums"
              />
            ) : (
              <CountdownTimer
                startSecs={countdownDurationSecs ?? 0}
                className="font-mono text-secondary tabular-nums"
              />
            )}
          </div>

          {sold ? (
            <p className="text-sm text-base-content/40">
              This auction has settled.
            </p>
          ) : (
            <button
              ref={btnRef}
              type="button"
              onClick={handleBid}
              disabled={bidDisabled}
              className="btn btn-secondary w-full sm:w-auto min-w-[200px] text-base font-semibold tracking-wide disabled:opacity-50"
            >
              Bid on this auction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
