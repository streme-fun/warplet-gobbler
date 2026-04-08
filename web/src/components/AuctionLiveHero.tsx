"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const n = Number.parseFloat(amountStr.replace(/,/g, ""));
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

export type AuctionLiveHeroChainSettlement = {
  label: string;
  onSubmit: () => Promise<void>;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  onClearError?: () => void;
  /** Short line under the primary button (e.g. what the action does). */
  hint?: string | null;
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
  bidDisabled,
  onBid,
  chainBid,
  chainSettlement,
  postAuctionNoActionHint,
  expiredLotCaption,
  idleNoChainAuction,
  auctionExpiredOnChain,
  contractPaused,
  bidInviteCopy,
  extendSuccessTick,
  countdownResetKey,
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
  bidDisabled?: boolean;
  onBid?: (
    fid: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  /** Live on-chain lot — bid form (amount + Bid) inside this card. */
  chainBid?: AuctionLiveHeroChainBid;
  /** Ended lot — finalize settlement / extend empty round. */
  chainSettlement?: AuctionLiveHeroChainSettlement | null;
  /** Shown under top bid when lot time is up (on-chain). */
  expiredLotCaption?: string | null;
  idleNoChainAuction?: boolean;
  auctionExpiredOnChain?: boolean;
  contractPaused?: boolean;
  /** Live lot, no bids yet — nudge to bid (on-chain). */
  bidInviteCopy?: string | null;
  /** Expired lot, no bids, house paused — there is no wallet tx until unpause. */
  postAuctionNoActionHint?: string | null;
  /** Incremented in parent after a successful `extendAuction` tx (drives banner + glow). */
  extendSuccessTick?: number;
  /** On-chain `endTime` as string — remounts countdown when the listing is extended. */
  countdownResetKey?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const renewFlashRef = useRef<HTMLDivElement>(null);
  const artFrameRef = useRef<HTMLDivElement>(null);
  const [bidAmountRaw, setBidAmountRaw] = useState("");
  const [bidValidationError, setBidValidationError] = useState<string | null>(
    null,
  );
  const [showExtendSuccessBanner, setShowExtendSuccessBanner] = useState(false);

  const chainBlocksBid = Boolean(
    contractPaused || auctionExpiredOnChain || idleNoChainAuction,
  );

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

  const tick = extendSuccessTick ?? 0;
  useEffect(() => {
    if (tick === 0) return;
    setShowExtendSuccessBanner(true);
    const t = setTimeout(() => setShowExtendSuccessBanner(false), 6500);
    return () => clearTimeout(t);
  }, [tick]);

  useEffect(() => {
    if (tick === 0) return;
    const el = renewFlashRef.current;
    if (!el) return;
    el.classList.remove("animate-auction-listing-renewed");
    void el.offsetWidth;
    el.classList.add("animate-auction-listing-renewed");
    const done = () => el.classList.remove("animate-auction-listing-renewed");
    el.addEventListener("animationend", done, { once: true });
    return () => {
      el.removeEventListener("animationend", done);
      el.classList.remove("animate-auction-listing-renewed");
    };
  }, [tick]);

  const handleDemoBid = () => {
    if (bidDisabled || auctionSettled || chainBlocksBid) return;
    if (!onBid || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    onBid(displayTokenId, {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    });
  };

  const handleChainBidSubmit = async () => {
    if (
      !chainBid ||
      chainBid.minBidWei == null ||
      chainBid.minBidHuman == null
    ) {
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

  const txOrValidationError = chainBid?.error ?? bidValidationError;

  const sold = auctionSettled;
  const hasHighBidder =
    topBidder != null && !isAddressEqual(topBidder, zeroAddress);

  return (
    <div className="px-2 py-5 sm:px-4 sm:py-8">
      <div className="grid grid-cols-[2fr_1fr] gap-3 sm:gap-6 lg:gap-10 items-center">
        {/* Left column — warplet image (2/3) */}
        <div className="flex flex-col items-center">
          {idleNoChainAuction ? (
            <div
              ref={artFrameRef}
              className="w-full aspect-square rounded-xl border border-dashed border-secondary/25 bg-base-100/15 flex flex-col items-center justify-center gap-1 px-2 text-center"
            >
              <p className="text-xs sm:text-sm text-base-content/55 font-medium">
                No live lot
              </p>
              <p className="text-[9px] sm:text-[11px] text-base-content/40 leading-snug">
                Nothing is selling yet.
              </p>
            </div>
          ) : (
            <>
              <div ref={artFrameRef} className="w-full aspect-square">
                <div className="auction-warplet-aura h-full w-full min-h-0 rounded-xl">
                  <div className="h-full w-full min-h-0 rounded-xl relative overflow-hidden">
                    <AuctionWarpletImage fid={displayTokenId} variant="hero" />
                    <p className="absolute bottom-0 inset-x-0 text-[10px] sm:text-xs lg:text-sm font-medium text-base-content/70 bg-black/50 backdrop-blur-sm py-1 sm:py-1.5 px-2 text-center m-0">
                      Warplet #{displayTokenId}
                    </p>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <AuctionBundleMini />
              </div>
            </>
          )}
        </div>

        {/* Right column — countdown + top bid */}
        <div className="flex flex-col gap-3 sm:gap-4 min-w-0 text-left">
          {!sold && !idleNoChainAuction ? (
            <div aria-live="polite" aria-label="Time remaining in lot">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                Time left
              </p>
              {countdownEndUnix !== undefined ? (
                <CountdownTimer
                  key={countdownResetKey ?? String(countdownEndUnix)}
                  endUnix={countdownEndUnix}
                  className="inline-block text-xl sm:text-2xl lg:text-3xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                />
              ) : countdownDurationSecs !== undefined ? (
                <CountdownTimer
                  startSecs={countdownDurationSecs}
                  className="inline-block text-xl sm:text-2xl lg:text-3xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                />
              ) : (
                <span className="inline-block text-xl sm:text-2xl lg:text-3xl font-mono font-semibold text-base-content/25 tabular-nums">
                  —:—:—
                </span>
              )}
            </div>
          ) : null}

          {showExtendSuccessBanner && !idleNoChainAuction && !sold ? (
            <div
              className="w-full rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 sm:px-4 sm:py-3 text-left shadow-[0_0_24px_-8px_rgba(0,245,255,0.35)] animate-fade-up"
              role="status"
            >
              <p className="text-xs sm:text-sm font-medium text-primary/95">
                Listing extended
              </p>
              <p className="text-[10px] sm:text-xs text-base-content/60 mt-1 leading-relaxed">
                Fresh bidding window opened.
              </p>
            </div>
          ) : null}

          <div
            ref={renewFlashRef}
            className="w-full rounded-xl transition-[box-shadow] duration-500"
          >
            <div className="w-full space-y-2 sm:space-y-3">
              <div>
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                  Top bid
                </p>
                {idleNoChainAuction ? (
                  <p className="text-base sm:text-xl font-mono text-base-content/45">
                    —
                  </p>
                ) : sold ? (
                  <p className="text-lg sm:text-2xl font-mono text-success">
                    Settled
                  </p>
                ) : showNoBids ? (
                  <div className="space-y-1">
                    <p className="text-base sm:text-xl font-mono text-base-content/50">
                      No bids yet
                    </p>
                    {bidInviteCopy && !auctionExpiredOnChain ? (
                      <p className="text-[10px] sm:text-xs text-secondary/80 font-medium">
                        {bidInviteCopy}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm sm:text-lg font-mono text-base-content tabular-nums">
                    {topBidAmountStr}{" "}
                    <span className="text-base-content/40 text-xs sm:text-sm">
                      {bidSymbol}
                    </span>
                  </p>
                )}
              </div>
              {contractPaused && !sold && !idleNoChainAuction && (
                <p className="text-[10px] sm:text-xs text-warning/80">
                  Auction house paused.
                </p>
              )}
              {auctionExpiredOnChain &&
                !sold &&
                !idleNoChainAuction &&
                expiredLotCaption && (
                  <p className="text-[10px] sm:text-xs text-base-content/50">
                    {expiredLotCaption}
                  </p>
                )}
              {!sold && !showNoBids && hasHighBidder && topBidder && (
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                    High bidder
                  </p>
                  <BidderAvatarName
                    address={topBidder}
                    viewerAddress={viewerAddress ?? undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom bid bar — portaled to escape stacking context, above gobbler jaw */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed left-0 right-0 bottom-[30px] sm:bottom-[100px] z-[45] flex justify-center pointer-events-none">
            <div className="w-full max-w-2xl px-4 sm:px-6 pointer-events-auto">
              {sold ? (
                <p className="text-sm text-base-content/40 text-center bg-base-200/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-base-content/10">
                  This auction has settled.
                </p>
              ) : idleNoChainAuction ? null : chainSettlement ? (
                <div className="space-y-2 bg-base-200/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-base-content/10">
                  <button
                    type="button"
                    onClick={() => void chainSettlement.onSubmit()}
                    disabled={
                      chainSettlement.disabled || chainSettlement.loading
                    }
                    className="btn btn-secondary w-full text-base font-semibold tracking-wide disabled:opacity-50"
                  >
                    {chainSettlement.loading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      chainSettlement.label
                    )}
                  </button>
                  {chainSettlement.hint ? (
                    <p className="text-xs text-base-content/45 text-center">
                      {chainSettlement.hint}
                    </p>
                  ) : null}
                  {chainSettlement.error ? (
                    <p className="text-xs text-error/90 break-words text-center">
                      {chainSettlement.error}
                    </p>
                  ) : null}
                </div>
              ) : postAuctionNoActionHint ? (
                <p className="text-xs text-base-content/50 leading-relaxed text-center bg-base-200/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-base-content/10">
                  {postAuctionNoActionHint}
                </p>
              ) : chainBid ? (
                <div className="space-y-2 bg-base-200/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-base-content/10">
                  <label className="form-control w-full">
                    <span className="label py-0 min-h-0 pb-1.5 justify-start">
                      <span className="label-text text-[10px] sm:text-xs uppercase tracking-wider text-base-content/50">
                        Your bid ({bidSymbol})
                      </span>
                    </span>
                    <div className="flex gap-2 sm:gap-3 items-center w-full min-w-0">
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
                  className="btn btn-secondary w-full text-base font-semibold tracking-wide disabled:opacity-50 bg-base-200/80 backdrop-blur-sm border border-base-content/10"
                >
                  Bid
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
