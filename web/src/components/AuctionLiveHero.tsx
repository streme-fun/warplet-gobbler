"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import type { Address } from "viem";
import AuctionWarpletImage from "./AuctionWarpletImage";
import AuctionLiveHeroSkeleton from "./AuctionLiveHeroSkeleton";
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

export type AuctionLiveHeroStartNewAuction = {
  onStart: () => void;
  loading: boolean;
  /** Wallet signature vs block inclusion — drives status line under button. */
  loadingStage?: "signing" | "confirming" | null;
  disabled: boolean;
  error: string | null;
  /** Show unpause guidance instead of generic hint. */
  housePaused: boolean;
};

export type AuctionLiveHeroSettlementTransition = {
  active: boolean;
  stage: "signing" | "confirming" | "syncing" | null;
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
  settledFooterCopy,
  startNewAuction,
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
  bidLandTick,
  auctionRevealTick,
  settlementTransition,
  countdownResetKey,
  artworkSkeleton,
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
  /** Line under the card when the lot is settled (queue-aware copy from parent). */
  settledFooterCopy?: string | null;
  /** Shown directly under the green “Settled” label when the next lot can be opened. */
  startNewAuction?: AuctionLiveHeroStartNewAuction | null;
  bidDisabled?: boolean;
  onBid?: (fid: number, rect: { x: number; y: number; w: number; h: number }) => void;
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
  /**
   * Incremented after a successful on-chain bid once the feedback overlay + refetch gate completes.
   * Drives “land in” motion on the top bid amount.
   */
  bidLandTick?: number;
  /** After `settleCurrentAndCreateNewAuction` — plays entrance motion when the new lot is shown. */
  auctionRevealTick?: number;
  /** Full-hero skeleton while finalize / extend / settle txs run. */
  settlementTransition?: AuctionLiveHeroSettlementTransition;
  /** On-chain `endTime` as string — remounts countdown when the listing is extended. */
  countdownResetKey?: string;
  artworkSkeleton?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRevealRef = useRef<HTMLDivElement>(null);
  const bidTopAmountRef = useRef<HTMLParagraphElement>(null);
  const renewFlashRef = useRef<HTMLDivElement>(null);
  const artFrameRef = useRef<HTMLDivElement>(null);
  const [artFrameHeightPx, setArtFrameHeightPx] = useState<number | null>(null);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [bidAmountRaw, setBidAmountRaw] = useState("");
  const [bidValidationError, setBidValidationError] = useState<string | null>(
    null,
  );
  const [showExtendSuccessBanner, setShowExtendSuccessBanner] = useState(false);
  const [startAuctionPressPulse, setStartAuctionPressPulse] = useState(false);

  const chainBlocksBid =
    Boolean(contractPaused || auctionExpiredOnChain || idleNoChainAuction);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLgViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = artFrameRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setArtFrameHeightPx(Math.round(h));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayTokenId, idleNoChainAuction, artworkSkeleton]);

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

  const bidLand = bidLandTick ?? 0;
  useEffect(() => {
    if (bidLand === 0) return;
    if (auctionSettled || showNoBids || idleNoChainAuction) return;

    const el = bidTopAmountRef.current;
    if (!el) return;

    el.classList.remove("animate-bid-top-land");
    void el.offsetWidth;
    el.classList.add("animate-bid-top-land");
    const done = () => el.classList.remove("animate-bid-top-land");
    el.addEventListener("animationend", done, { once: true });
    return () => {
      el.removeEventListener("animationend", done);
      el.classList.remove("animate-bid-top-land");
    };
  }, [bidLand, auctionSettled, showNoBids, idleNoChainAuction]);

  const revealTick = auctionRevealTick ?? 0;
  useEffect(() => {
    if (revealTick === 0) return;
    const el = cardRevealRef.current;
    if (!el) return;
    el.classList.remove("animate-auction-new-lot-reveal");
    void el.offsetWidth;
    el.classList.add("animate-auction-new-lot-reveal");
    const done = () => el.classList.remove("animate-auction-new-lot-reveal");
    el.addEventListener("animationend", done, { once: true });
    return () => {
      el.removeEventListener("animationend", done);
      el.classList.remove("animate-auction-new-lot-reveal");
    };
  }, [revealTick]);

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

  const showSettleSkeleton = settlementTransition?.active === true;

  return (
    <div
      ref={cardRevealRef}
      className="rounded-2xl border border-base-content/10 bg-base-200/25 p-5 sm:p-8 transition-shadow duration-300"
    >
      {showSettleSkeleton ? (
        <AuctionLiveHeroSkeleton
          stage={
            settlementTransition?.active ? settlementTransition.stage : null
          }
        />
      ) : (
        <>
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
        <div className="flex-shrink-0 mx-auto lg:mx-0 w-full max-w-[220px] sm:max-w-[260px] flex flex-col items-center">
          {idleNoChainAuction ? (
            <div
              ref={artFrameRef}
              className="w-full aspect-square rounded-xl border border-dashed border-secondary/25 bg-base-100/15 flex flex-col items-center justify-center gap-2 px-4 text-center"
            >
              <p className="text-sm text-base-content/55 font-medium">No live lot</p>
              <p className="text-[11px] text-base-content/40 leading-snug">
                Nothing is selling yet — queue empty, house paused, or the next auction has not been started.
              </p>
            </div>
          ) : artworkSkeleton ? (
            <>
              <div ref={artFrameRef} className="w-full aspect-square">
                <div className="auction-warplet-aura h-full w-full min-h-0 rounded-xl">
                  <div className="h-full w-full min-h-0 rounded-xl overflow-hidden">
                    <div className="skeleton h-full w-full rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="mt-2 skeleton h-4 w-28 rounded-md" />
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 w-full">
                <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
                <div className="skeleton w-3 h-3 rounded-sm opacity-50 shrink-0" />
                <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
                <div className="skeleton w-3 h-3 rounded-sm opacity-50 shrink-0" />
                <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
              </div>
            </>
          ) : (
            <>
              <div ref={artFrameRef} className="w-full aspect-square">
                <div className="auction-warplet-aura h-full w-full min-h-0 rounded-xl">
                  <div className="h-full w-full min-h-0 rounded-xl overflow-hidden">
                    <AuctionWarpletImage
                      fid={displayTokenId}
                      variant="hero"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs sm:text-sm font-medium text-base-content/70">
                Warplet #{displayTokenId}
              </p>
              <AuctionBundleMini />
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-3 sm:gap-4 min-w-0 min-h-0">
          <div
            className="w-full flex flex-col gap-3 sm:gap-4 lg:min-h-0 lg:min-w-0"
            style={
              isLgViewport && artFrameHeightPx != null
                ? { minHeight: artFrameHeightPx }
                : undefined
            }
          >
            <div className="w-full flex items-end justify-between gap-3 sm:gap-4 shrink-0">
              <div className="min-w-0 flex-1 text-left">
                <h2 className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-secondary m-0">
                  Today&apos;s auction
                </h2>
                <p className="text-sm text-base-content/55 mt-1 mb-0 max-w-md mx-auto lg:mx-0 lg:mr-auto">
                  Every day, one Warplet is rescued.
                  <br />
                  Bid to make them yours.
                </p>
              </div>
              {!sold && !idleNoChainAuction ? (
                <div
                  className="shrink-0 text-right leading-none pb-px"
                  aria-live="polite"
                  aria-label="Time remaining in lot"
                >
                  {countdownEndUnix !== undefined ? (
                    <CountdownTimer
                      key={countdownResetKey ?? String(countdownEndUnix)}
                      endUnix={countdownEndUnix}
                      className="inline-block text-2xl sm:text-3xl md:text-3xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                    />
                  ) : countdownDurationSecs !== undefined ? (
                    <CountdownTimer
                      startSecs={countdownDurationSecs}
                      className="inline-block text-2xl sm:text-3xl md:text-3xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                    />
                  ) : (
                    <span className="inline-block text-2xl sm:text-3xl font-mono font-semibold text-base-content/25 tabular-nums">
                      —:—:—
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {showExtendSuccessBanner && !idleNoChainAuction && !sold ? (
              <div
                className="w-full rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-left shadow-[0_0_24px_-8px_rgba(0,245,255,0.35)] animate-fade-up shrink-0"
                role="status"
              >
                <p className="text-sm font-medium text-primary/95">
                  Listing extended
                </p>
                <p className="text-xs text-base-content/60 mt-1 leading-relaxed">
                  The chain has opened a fresh window — bidding picks up from the
                  updated countdown.
                </p>
              </div>
            ) : null}

            <div
              ref={renewFlashRef}
              className="w-full flex-1 flex flex-col rounded-xl transition-[box-shadow] duration-500 min-h-0"
            >
              <div
                className={`w-full flex-1 rounded-xl bg-base-100/30 border px-4 py-3 sm:py-4 flex flex-col justify-center space-y-3 transition-colors duration-500 ${
                  startNewAuction?.loading
                    ? "border-secondary/40 animate-auction-tx-pending"
                    : "border-base-content/10"
                }`}
              >
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                Top bid
              </p>
              {idleNoChainAuction ? (
                <p className="text-lg sm:text-xl font-mono text-base-content/45">—</p>
              ) : sold ? (
                <div className="space-y-3">
                  <p
                    className={`text-xl sm:text-2xl font-mono text-success transition-all duration-300 ${
                      startNewAuction?.loading
                        ? "scale-[1.02] drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                        : ""
                    }`}
                  >
                    Settled
                  </p>
                  {startNewAuction ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (
                            startNewAuction.disabled ||
                            startNewAuction.loading
                          ) {
                            return;
                          }
                          setStartAuctionPressPulse(true);
                          window.setTimeout(
                            () => setStartAuctionPressPulse(false),
                            220,
                          );
                          void startNewAuction.onStart();
                        }}
                        disabled={
                          startNewAuction.disabled || startNewAuction.loading
                        }
                        className={`btn btn-secondary btn-outline btn-sm w-full sm:w-auto min-w-[200px] font-semibold tracking-wide transition-all duration-200 ease-out hover:shadow-[0_0_22px_-6px_rgba(123,97,255,0.55)] active:scale-[0.97] disabled:opacity-60 ${
                          startAuctionPressPulse ? "scale-[0.96]" : ""
                        }`}
                      >
                        {startNewAuction.loading ? (
                          <span className="flex items-center gap-2">
                            <span className="loading loading-spinner loading-sm text-secondary" />
                            <span className="font-normal normal-case tracking-normal">
                              {startNewAuction.loadingStage === "confirming"
                                ? "Confirming…"
                                : "Waiting for wallet…"}
                            </span>
                          </span>
                        ) : (
                          "Start new auction"
                        )}
                      </button>
                      {startNewAuction.loading &&
                      !startNewAuction.error &&
                      !startNewAuction.housePaused ? (
                        <p
                          className="text-xs text-secondary/80 font-medium animate-pulse"
                          role="status"
                          aria-live="polite"
                        >
                          {startNewAuction.loadingStage === "confirming"
                            ? "Transaction is confirming on Base — hang tight."
                            : "Check your wallet or browser wallet popup to sign the transaction."}
                        </p>
                      ) : null}
                      {startNewAuction.error ? (
                        <p className="text-xs text-error/90 break-words">
                          {startNewAuction.error}
                        </p>
                      ) : startNewAuction.housePaused ? (
                        <p className="text-xs text-warning/85 max-w-md leading-relaxed">
                          Auction house is paused on-chain — unpause (owner)
                          first. You can then start the next lot here; unpause may
                          also open it automatically.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : showNoBids ? (
                <div className="space-y-1.5">
                  <p className="text-lg sm:text-xl font-mono text-base-content/50">
                    No bids yet
                  </p>
                  {bidInviteCopy && !auctionExpiredOnChain ? (
                    <p className="text-xs text-secondary/80 font-medium">
                      {bidInviteCopy}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p
                  ref={bidTopAmountRef}
                  className="text-xl sm:text-2xl font-mono text-base-content tabular-nums"
                >
                  {topBidAmountStr}{" "}
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
            {auctionExpiredOnChain &&
              !sold &&
              !idleNoChainAuction &&
              expiredLotCaption && (
                <p className="text-xs text-base-content/50">{expiredLotCaption}</p>
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
            </div>
          </div>

          {sold ? (
            <p
              className={`text-sm transition-all duration-300 ${
                startNewAuction?.loading
                  ? "text-secondary/75 animate-pulse font-medium"
                  : "text-base-content/40"
              }`}
            >
              {settledFooterCopy ??
                "The last auction has ended. Click to start a new auction"}
            </p>
          ) : idleNoChainAuction ? null : chainSettlement ? (
            <div className="w-full max-w-2xl space-y-2 pt-1">
              <button
                type="button"
                onClick={() => void chainSettlement.onSubmit()}
                disabled={chainSettlement.disabled || chainSettlement.loading}
                className="btn btn-secondary w-full sm:w-auto min-w-[200px] text-base font-semibold tracking-wide disabled:opacity-50"
              >
                {chainSettlement.loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  chainSettlement.label
                )}
              </button>
              {chainSettlement.hint ? (
                <p className="text-xs text-base-content/45 max-w-md">
                  {chainSettlement.hint}
                </p>
              ) : null}
              {chainSettlement.error ? (
                <p className="text-xs text-error/90 break-words">
                  {chainSettlement.error}
                </p>
              ) : null}
            </div>
          ) : postAuctionNoActionHint ? (
            <p className="w-full max-w-2xl pt-1 text-xs text-base-content/50 leading-relaxed">
              {postAuctionNoActionHint}
            </p>
          ) : chainBid ? (
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
        </>
      )}
    </div>
  );
}
