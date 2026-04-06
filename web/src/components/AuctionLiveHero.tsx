"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Trim trailing zeros for a cleaner default in the bid input (e.g. 1.000… → 1). */
function trimDecimalDisplay(s: string): string {
  if (!s.includes(".")) return s;
  const t = s.replace(/0+$/, "").replace(/\.$/, "");
  return t.length > 0 ? t : "0";
}

/** ~0.01$ style — approximate notional from pool spot (only when price is known). */
function formatUsdTilde(usd: number | null): string {
  if (usd == null || !Number.isFinite(usd)) return "~—$";
  const abs = Math.abs(usd);
  const maxFrac = abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
  const n = abs >= 100 ? Math.round(usd) : usd;
  return `~${n.toLocaleString(undefined, {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  })}$`;
}

export type AuctionLiveHeroChainBid = {
  minBidHuman: string | null;
  minBidWei: bigint | null;
  parseHumanToWei: (human: string) => bigint;
  onSubmit: (amountWei: bigint) => Promise<void>;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  onClearTxError?: () => void;
  /** USD per 1 bid token (e.g. WARPGOBB spot); omit or null when unknown. */
  bidTokenPriceUsd?: number | null;
};

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
  chainBid,
  idleNoChainAuction,
  auctionExpiredOnChain,
  contractPaused,
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
  onBid?: (fid: number, rect: { x: number; y: number; w: number; h: number }) => void;
  /** Live on-chain lot — bid form (amount + Bid) inside this card. */
  chainBid?: AuctionLiveHeroChainBid;
  idleNoChainAuction?: boolean;
  auctionExpiredOnChain?: boolean;
  contractPaused?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [bidAmountRaw, setBidAmountRaw] = useState("");
  const [bidValidationError, setBidValidationError] = useState<string | null>(
    null,
  );

  const chainBlocksBid =
    Boolean(contractPaused || auctionExpiredOnChain || idleNoChainAuction);

  const bidUsdEstimate = useMemo(() => {
    const spot = chainBid?.bidTokenPriceUsd;
    if (spot == null || !Number.isFinite(spot) || spot <= 0) return null;
    const raw = bidAmountRaw.trim().replace(/,/g, "");
    if (raw === "") return null;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n * spot;
  }, [bidAmountRaw, chainBid?.bidTokenPriceUsd]);

  useEffect(() => {
    if (chainBid?.minBidHuman == null) return;
    setBidAmountRaw(trimDecimalDisplay(chainBid.minBidHuman));
    setBidValidationError(null);
  }, [chainBid?.minBidHuman, chainBid?.minBidWei]);

  const handleDemoBid = () => {
    if (bidDisabled || auctionSettled || chainBlocksBid) return;
    if (!onBid || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    onBid(displayTokenId, { x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  };

  const handleChainBidSubmit = async () => {
    if (!chainBid || chainBid.minBidWei == null || chainBid.minBidHuman == null) {
      setBidValidationError("Loading…");
      return;
    }
    setBidValidationError(null);
    chainBid.onClearTxError?.();

    let wei: bigint;
    try {
      wei = chainBid.parseHumanToWei(bidAmountRaw);
    } catch {
      setBidValidationError(`Enter a valid amount in ${bidSymbol}.`);
      return;
    }
    if (wei < chainBid.minBidWei) {
      const minShown = formatBidHuman(trimDecimalDisplay(chainBid.minBidHuman));
      setBidValidationError(
        `Your bid must be at least ${minShown} ${bidSymbol}.`,
      );
      return;
    }

    await chainBid.onSubmit(wei);
    setBidValidationError(null);
  };

  const txOrValidationError =
    chainBid?.error ?? bidValidationError;

  const sold = auctionSettled;
  const hasHighBidder =
    topBidder != null && !isAddressEqual(topBidder, zeroAddress);

  return (
    <div className="rounded-2xl border border-secondary/35 bg-gradient-to-b from-secondary/15 to-base-200/30 p-5 sm:p-8 shadow-[0_0_40px_-12px_rgba(123,97,255,0.45)]">
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-10">
        <div className="flex-shrink-0 mx-auto lg:mx-0 w-full max-w-[220px] sm:max-w-[260px] flex flex-col items-center">
          {idleNoChainAuction ? (
            <div className="w-full aspect-square rounded-xl border border-dashed border-secondary/25 bg-base-100/15 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm text-base-content/55 font-medium">No live lot</p>
              <p className="text-[11px] text-base-content/40 leading-snug">
                Nothing is selling yet — queue empty, house paused, or the next auction has not been started.
              </p>
            </div>
          ) : (
            <>
              <div className="auction-warplet-aura w-full rounded-xl">
                <AuctionWarpletImage fid={displayTokenId} variant="hero" />
              </div>
              <AuctionBundleMini />
            </>
          )}
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
            {idleNoChainAuction ? "—" : `Warplet #${displayTokenId}`}
          </span>

          <div className="w-full rounded-xl bg-base-100/30 border border-base-content/10 px-4 py-3 sm:py-4 space-y-3">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                Top bid
              </p>
              {idleNoChainAuction ? (
                <p className="text-lg sm:text-xl font-mono text-base-content/45">—</p>
              ) : sold ? (
                <p className="text-xl sm:text-2xl font-mono text-success">Settled</p>
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
            {contractPaused && !sold && !idleNoChainAuction && (
              <p className="text-xs text-warning/80">
                Auction house is paused — bidding is disabled on-chain.
              </p>
            )}
            {auctionExpiredOnChain && !sold && !idleNoChainAuction && (
              <p className="text-xs text-base-content/50">
                Bidding closed — this lot is waiting for settlement.
              </p>
            )}
            {!sold && viewerIsLeadingBidder && (
              <p className="text-xs sm:text-sm text-success/85 font-medium">
                You&apos;re the top bidder — the lot is still open until the timer
                ends.
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
            {idleNoChainAuction ? (
              <span className="font-mono text-base-content/35 tabular-nums">—:—:—</span>
            ) : countdownEndUnix !== undefined ? (
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
            <p className="text-sm text-base-content/40">This auction has settled.</p>
          ) : idleNoChainAuction ? null : chainBid ? (
            <div className="w-full max-w-2xl space-y-2 pt-1">
              <label className="form-control w-full">
                <span className="label py-0 min-h-0 pb-1.5 justify-start">
                  <span className="label-text text-[10px] sm:text-xs uppercase tracking-wider text-base-content/50">
                    Your bid ({bidSymbol})
                  </span>
                </span>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center w-full min-w-0">
                  <div
                    className={`flex flex-1 min-w-0 min-h-10 items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/40 px-2 sm:px-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-[box-shadow,border-color] focus-within:border-secondary/50 focus-within:ring-1 focus-within:ring-secondary/25 ${
                      chainBid.disabled ||
                      chainBid.loading ||
                      chainBid.minBidHuman == null
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }`}
                  >
                    <span
                      className="shrink-0 text-left text-sm font-mono tabular-nums text-base-content/50 select-none"
                      title="Approximate USD (spot)"
                    >
                      {formatUsdTilde(bidUsdEstimate)}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent py-2 text-right font-mono text-sm tabular-nums text-base-content placeholder:text-base-content/25 outline-none border-0 focus:ring-0"
                      value={bidAmountRaw}
                      onChange={(e) => {
                        setBidAmountRaw(e.target.value);
                        setBidValidationError(null);
                        chainBid.onClearTxError?.();
                      }}
                      disabled={
                        chainBid.disabled ||
                        chainBid.loading ||
                        chainBid.minBidHuman == null
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleChainBidSubmit}
                    disabled={
                      bidDisabled ||
                      chainBlocksBid ||
                      chainBid.disabled ||
                      chainBid.loading ||
                      chainBid.minBidWei == null
                    }
                    className="btn btn-secondary shrink-0 min-w-[4.75rem] px-3 font-semibold tracking-wide disabled:opacity-50"
                  >
                    {chainBid.loading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "BID"
                    )}
                  </button>
                </div>
              </label>
              {txOrValidationError ? (
                <p className="text-xs text-error/90 text-left break-words pl-0.5">
                  {txOrValidationError}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              ref={btnRef}
              type="button"
              onClick={handleDemoBid}
              disabled={bidDisabled || chainBlocksBid}
              className="btn btn-secondary w-full sm:w-auto min-w-[200px] text-base font-semibold tracking-wide disabled:opacity-50"
            >
              Bid
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
