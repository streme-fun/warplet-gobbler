"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, isAddressEqual, parseUnits, zeroAddress } from "viem";
import type { Address } from "viem";
import type { AuctionBidPaymentMode } from "@/lib/defaultAuctionBidPayment";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";
import CountdownTimer from "./CountdownTimer";

function SettlementProgressStrip({
  stage,
}: {
  stage: "signing" | "confirming" | "syncing" | null;
}) {
  const statusLine =
    stage === "confirming"
      ? "Confirming on Base…"
      : stage === "syncing"
        ? "Syncing the live auction…"
        : "Waiting for wallet…";

  return (
    <div
      className="w-full rounded-lg border border-base-content/10 bg-base-100/15 px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="loading loading-spinner loading-md text-secondary shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-secondary/90">Settling auction</p>
        <p className="text-xs text-base-content/55 mt-0.5 leading-snug">
          {statusLine}
        </p>
      </div>
    </div>
  );
}

/** Trim trailing zeros for a cleaner default in the bid input (e.g. 1.000… → 1). */
function trimDecimalDisplay(s: string): string {
  if (!s.includes(".")) return s;
  const t = s.replace(/0+$/, "").replace(/\.$/, "");
  return t.length > 0 ? t : "0";
}

/** ~0.01$ style — approximate notional from pool spot (only when price is known). */
function formatUsdTilde(usd: number | null, maxFractionDigits = 2): string {
  if (usd == null || !Number.isFinite(usd)) return "~—$";
  return `~${usd.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  })}$`;
}

/** Small USD line under top bid (~$ prefix, same rounding spirit as `formatUsdTilde`). */
function formatUsdSmallBelow(usd: number): string {
  return `~$${usd.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

/** Strip grouping + spaces; keep one decimal point and digit runs. */
function normalizeBidString(input: string): string {
  const t = input.replace(/['\s,]/g, "");
  if (t === "") return "";
  const idx = t.indexOf(".");
  if (idx === -1) return t.replace(/\D/g, "");
  const int = t.slice(0, idx).replace(/\D/g, "");
  const frac = t.slice(idx + 1).replace(/\D/g, "");
  const trailingDotOnly =
    t.endsWith(".") && frac === "" && int.replace(/\D/g, "").length > 0;
  if (frac.length > 0) return `${int}.${frac}`;
  if (trailingDotOnly) return `${int}.`;
  return int;
}

/** Integer digits grouped like `formatBidAmount` / `toLocaleString` (matches top bid). */
function formatIntegerLocale(intDigits: string): string {
  const d = intDigits.replace(/\D/g, "");
  if (!d) return "";
  const stripped = d.replace(/^0+/, "") || "0";
  try {
    return BigInt(stripped).toLocaleString(undefined, { useGrouping: true });
  } catch {
    return stripped;
  }
}

function formatBidAmountDisplay(
  normalized: string,
  maxFracDigits: number,
  maxIntDigits = 9,
): string {
  if (normalized === "" || normalized === ".") return normalized;
  const trailingDot =
    normalized.endsWith(".") &&
    normalized.split(".").length === 2 &&
    (normalized.split(".")[1] ?? "") === "";
  const [intRaw, fracRaw = ""] = normalized.includes(".")
    ? normalized.split(".")
    : [normalized, ""];
  const int = intRaw.replace(/\D/g, "").slice(0, maxIntDigits);
  const intFmt = formatIntegerLocale(int);
  if (trailingDot) return `${intFmt}.`;
  const frac = fracRaw.replace(/\D/g, "").slice(0, maxFracDigits);
  return frac.length > 0 ? `${intFmt}.${frac}` : intFmt;
}

/** Plain decimal string for parseUnits (no grouping, no trailing dot). */
function bidDisplayToParseable(displayed: string, maxFracDigits: number): string {
  const n = normalizeBidString(displayed);
  if (n === "" || n === ".") return "0";
  const idx = n.indexOf(".");
  if (idx === -1) return n.replace(/\D/g, "") || "0";
  const int = n.slice(0, idx).replace(/\D/g, "");
  const frac = n.slice(idx + 1).replace(/\D/g, "").slice(0, maxFracDigits);
  return frac.length > 0 ? `${int}.${frac}` : int || "0";
}

/** Parse locale-formatted top bid string (grouping stripped) to a float for USD spot math. */
function parseTopBidHumanDisplay(display: string): number | null {
  const n = normalizeBidString(display.trim());
  if (n === "" || n === ".") return null;
  const flat = bidDisplayToParseable(n, 18);
  const v = Number.parseFloat(flat);
  return Number.isFinite(v) ? v : null;
}

const DEFAULT_BID_FLOOR_HUMAN = "1000000";
const TOKEN_INPUT_MAX_FRAC_DIGITS = 4;
const ETH_INPUT_MAX_FRAC_DIGITS = 6;
const BID_INPUT_MAX_INT_DIGITS = 9;

export type AuctionLiveHeroChainBid = {
  minBidHuman: string | null;
  minBidWei: bigint | null;
  bidDecimals: number;
  parseHumanToWei: (human: string) => bigint;
  onSubmit: (
    amountWei: bigint,
    opts?: { payment: "eth"; txValueWei: bigint } | { payment?: "token" },
  ) => Promise<void>;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  onClearTxError?: () => void;
  /** USD per 1 bid token (e.g. WARPGOBB spot); omit or null when unknown. */
  bidTokenPriceUsd?: number | null;
  defaultPaymentMethod?: AuctionBidPaymentMode;
  onBidWeiDebounced?: (wei: bigint) => void;
  viewerBidTokenBalanceHuman?: string | null;
  viewerEthBalanceHuman?: string | null;
  nativeEthBid?: {
    available: boolean;
    quoteLoading: boolean;
    quoteError: string | null;
    minEthFormatted: string | null;
    txValueWei: bigint | null;
    txValueFormatted: string | null;
    onRefreshQuote: () => void;
  };
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
  /** Explains why the button is disabled (empty queue, loading queue, etc.). */
  queueBlockedReason?: string | null;
};

function StartNewAuctionPanel({
  cfg,
}: {
  cfg: AuctionLiveHeroStartNewAuction;
}) {
  const [pressPulse, setPressPulse] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (cfg.disabled || cfg.loading) return;
          setPressPulse(true);
          window.setTimeout(() => setPressPulse(false), 220);
          cfg.onStart();
        }}
        disabled={cfg.disabled || cfg.loading}
        className={`btn btn-secondary flex mx-auto w-max max-w-full px-6 sm:px-8 text-base font-semibold tracking-wide transition-all duration-200 ease-out hover:shadow-[0_0_22px_-6px_rgba(123,97,255,0.55)] active:scale-[0.97] disabled:opacity-60 ${
          pressPulse ? "scale-[0.98]" : ""
        }`}
      >
        {cfg.loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="loading loading-spinner loading-sm text-secondary" />
            <span className="font-normal normal-case tracking-normal">
              {cfg.loadingStage === "confirming"
                ? "Confirming…"
                : "Waiting for wallet…"}
            </span>
          </span>
        ) : (
          "Restart auction"
        )}
      </button>
      {cfg.queueBlockedReason ? (
        <p className="text-xs text-base-content/55 text-center leading-relaxed">
          {cfg.queueBlockedReason}
        </p>
      ) : null}
      {cfg.loading &&
      !cfg.error &&
      !cfg.housePaused &&
      !cfg.queueBlockedReason ? (
        <p
          className="text-xs text-secondary/80 font-medium animate-pulse text-center"
          role="status"
          aria-live="polite"
        >
          {cfg.loadingStage === "confirming"
            ? "Transaction is confirming on Base — hang tight."
            : "Check your wallet or browser wallet popup to sign the transaction."}
        </p>
      ) : null}
      {cfg.error ? (
        <p className="text-xs text-error/90 break-words text-center">{cfg.error}</p>
      ) : cfg.housePaused ? (
        <p className="max-w-md mx-auto text-xs text-warning/85 leading-relaxed text-center">
          Auction house is paused on-chain — unpause (owner) first. You can then
          start the next lot here; unpause may also open it automatically.
        </p>
      ) : null}
    </>
  );
}

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
  onBid?: (
    fid: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  /** Live on-chain lot — bid form (amount + Bid) inside this card. */
  chainBid?: AuctionLiveHeroChainBid;
  /** Ended lot — finalize settlement / extend empty round. */
  chainSettlement?: AuctionLiveHeroChainSettlement | null;
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
  const bidInputRef = useRef<HTMLInputElement>(null);
  const cardRevealRef = useRef<HTMLDivElement>(null);
  const bidTopAmountRef = useRef<HTMLParagraphElement>(null);
  const renewFlashRef = useRef<HTMLDivElement>(null);
  const userSelectedPaymentModeRef = useRef(false);
  const [bidAmountRaw, setBidAmountRaw] = useState("");
  const [ethAmountDisplayRaw, setEthAmountDisplayRaw] = useState("");
  const [bidValidationError, setBidValidationError] = useState<string | null>(
    null,
  );
  const [showExtendSuccessBanner, setShowExtendSuccessBanner] = useState(false);
  const [paymentMode, setPaymentMode] = useState<AuctionBidPaymentMode>("token");

  const chainBlocksBid = Boolean(
    contractPaused || auctionExpiredOnChain || idleNoChainAuction,
  );
  const nativeEthBlocksBid = Boolean(
    paymentMode === "eth" &&
      chainBid?.nativeEthBid?.available === true &&
      (chainBid.nativeEthBid.txValueWei == null ||
        (chainBid.nativeEthBid.quoteLoading &&
          chainBid.nativeEthBid.txValueWei == null)),
  );

  const bidUsdEstimate = useMemo(() => {
    const spot = chainBid?.bidTokenPriceUsd;
    const dec = chainBid?.bidDecimals;
    if (
      spot == null ||
      !Number.isFinite(spot) ||
      spot <= 0 ||
      dec == null
    ) {
      return null;
    }
    const raw = bidDisplayToParseable(bidAmountRaw, dec);
    if (raw === "" || raw === "0") return null;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n * spot;
  }, [bidAmountRaw, chainBid?.bidTokenPriceUsd, chainBid?.bidDecimals]);

  useEffect(() => {
    if (chainBid?.minBidWei == null || chainBid.bidDecimals == null) return;
    let chosen: bigint;
    try {
      const floor = parseUnits(DEFAULT_BID_FLOOR_HUMAN, chainBid.bidDecimals);
      chosen = chainBid.minBidWei > floor ? chainBid.minBidWei : floor;
    } catch {
      chosen = chainBid.minBidWei;
    }
    try {
      const human = trimDecimalDisplay(
        formatUnits(chosen, chainBid.bidDecimals),
      );
      setBidAmountRaw(
        formatBidAmountDisplay(
          human,
          Math.min(chainBid.bidDecimals, TOKEN_INPUT_MAX_FRAC_DIGITS),
          BID_INPUT_MAX_INT_DIGITS,
        ),
      );
    } catch {
      if (chainBid.minBidHuman != null) {
        setBidAmountRaw(
          formatBidAmountDisplay(
            trimDecimalDisplay(chainBid.minBidHuman),
            Math.min(chainBid.bidDecimals, TOKEN_INPUT_MAX_FRAC_DIGITS),
            BID_INPUT_MAX_INT_DIGITS,
          ),
        );
      }
    }
    setBidValidationError(null);
  }, [chainBid?.minBidWei, chainBid?.bidDecimals, chainBid?.minBidHuman]);

  useEffect(() => {
    if (!chainBid) return;
    const nativeAvailable = chainBid.nativeEthBid?.available === true;
    if (!nativeAvailable) {
      setPaymentMode("token");
      userSelectedPaymentModeRef.current = false;
      return;
    }
    if (!userSelectedPaymentModeRef.current) {
      setPaymentMode(chainBid.defaultPaymentMethod ?? "token");
    }
  }, [chainBid?.defaultPaymentMethod, chainBid?.nativeEthBid?.available]);

  useEffect(() => {
    // New lot -> re-apply automatic default until user switches again.
    userSelectedPaymentModeRef.current = false;
  }, [displayTokenId]);

  useEffect(() => {
    if (!chainBid?.onBidWeiDebounced || chainBid?.bidDecimals == null) return;
    const id = window.setTimeout(() => {
      try {
        const wei = chainBid.parseHumanToWei(
          bidDisplayToParseable(bidAmountRaw, chainBid.bidDecimals),
        );
        chainBid.onBidWeiDebounced?.(wei);
      } catch {
        // ignore invalid intermediate input
      }
    }, 220);
    return () => window.clearTimeout(id);
  }, [
    bidAmountRaw,
    chainBid?.onBidWeiDebounced,
    chainBid?.parseHumanToWei,
    chainBid?.bidDecimals,
  ]);

  useEffect(() => {
    if (paymentMode !== "eth") return;
    const quoted = chainBid?.nativeEthBid?.txValueFormatted;
    if (!quoted) return;
    const formatted = formatBidAmountDisplay(
      normalizeBidString(quoted),
      ETH_INPUT_MAX_FRAC_DIGITS,
      BID_INPUT_MAX_INT_DIGITS,
    );
    setEthAmountDisplayRaw(formatted);
  }, [paymentMode, chainBid?.nativeEthBid?.txValueFormatted]);

  useEffect(() => {
    if (paymentMode !== "eth") return;
    if (!chainBid?.nativeEthBid?.available) return;
    if (chainBid.nativeEthBid.quoteLoading) return;
    if (chainBid.nativeEthBid.txValueWei != null) return;
    chainBid.nativeEthBid.onRefreshQuote();
  }, [
    paymentMode,
    chainBid?.nativeEthBid?.available,
    chainBid?.nativeEthBid?.quoteLoading,
    chainBid?.nativeEthBid?.txValueWei,
    chainBid?.nativeEthBid?.onRefreshQuote,
  ]);

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
      chainBid.minBidHuman == null ||
      chainBid.bidDecimals == null
    ) {
      setBidValidationError("Loading…");
      return;
    }
    setBidValidationError(null);
    chainBid.onClearTxError?.();

    let wei: bigint;
    try {
      wei = chainBid.parseHumanToWei(
        bidDisplayToParseable(bidAmountRaw, chainBid.bidDecimals),
      );
    } catch {
      setBidValidationError(`Enter a valid amount in ${bidSymbol}.`);
      return;
    }
    if (wei < chainBid.minBidWei) {
      const minShown = formatBidAmountDisplay(
        trimDecimalDisplay(chainBid.minBidHuman),
        Math.min(chainBid.bidDecimals, TOKEN_INPUT_MAX_FRAC_DIGITS),
        BID_INPUT_MAX_INT_DIGITS,
      );
      setBidValidationError(
        `Your bid must be at least ${minShown} ${bidSymbol}.`,
      );
      return;
    }

    if (paymentMode === "eth") {
      const txValueWei = chainBid.nativeEthBid?.txValueWei ?? null;
      if (txValueWei == null || txValueWei <= 0n) {
        setBidValidationError("ETH quote unavailable. Try refresh estimate.");
        return;
      }
      await chainBid.onSubmit(wei, { payment: "eth", txValueWei });
    } else {
      await chainBid.onSubmit(wei, { payment: "token" });
    }
    setBidValidationError(null);
  };

  const txOrValidationError = chainBid?.error ?? bidValidationError;

  const handlePaymentModeToggle = () => {
    if (!chainBid?.nativeEthBid?.available) return;
    userSelectedPaymentModeRef.current = true;
    const nextMode: AuctionBidPaymentMode =
      paymentMode === "token" ? "eth" : "token";
    setPaymentMode(nextMode);
    if (nextMode === "eth") {
      const quoted = chainBid.nativeEthBid?.txValueFormatted;
      if (quoted) {
        setEthAmountDisplayRaw(
          formatBidAmountDisplay(
            normalizeBidString(quoted),
            ETH_INPUT_MAX_FRAC_DIGITS,
            BID_INPUT_MAX_INT_DIGITS,
          ),
        );
      } else {
        chainBid.nativeEthBid?.onRefreshQuote();
      }
    }
  };

  const sold = auctionSettled;
  const hasHighBidder =
    topBidder != null && !isAddressEqual(topBidder, zeroAddress);
  const hasNextAuctionToken = Boolean(
    startNewAuction && !startNewAuction.queueBlockedReason,
  );

  const topBidUsdNotional = useMemo(() => {
    const spot = chainBid?.bidTokenPriceUsd;
    if (
      spot == null ||
      !Number.isFinite(spot) ||
      spot <= 0 ||
      showNoBids ||
      idleNoChainAuction ||
      sold
    ) {
      return null;
    }
    const human = parseTopBidHumanDisplay(topBidAmountStr);
    if (human == null) return null;
    return human * spot;
  }, [
    chainBid?.bidTokenPriceUsd,
    idleNoChainAuction,
    showNoBids,
    sold,
    topBidAmountStr,
  ]);

  const showSettleSkeleton = settlementTransition?.active === true;
  const settleStage = settlementTransition?.active
    ? settlementTransition.stage
    : null;

  return (
    <div
      ref={cardRevealRef}
      className="px-2 py-5 sm:px-4 sm:py-8 transition-shadow duration-300"
    >
      <div className="auction-warplet-aura">
        <div className="px-2 pb-4 text-center sm:hidden">
          <h2 className="m-0 text-[1.37rem] font-bold uppercase tracking-tight text-secondary leading-tight">
            DAILY WARPLET AUCTION
          </h2>
          <p className="mx-auto mt-1.5 mb-3 max-w-xl text-[10px] leading-snug text-base-content/65">
            A Warplet a day keeps the Gobbler away. Bid to win.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none sm:grid-cols-[minmax(272px,2.4fr)_minmax(17rem,2fr)] sm:items-stretch sm:rounded-[0.82rem] sm:border sm:border-secondary/25 sm:bg-base-100/25 sm:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {/* Left — square art (~20% narrower track than prior 3fr); never squashed */}
        <div className="relative isolate flex w-full flex-col bg-transparent sm:min-h-0 sm:h-full sm:bg-gradient-to-br sm:from-base-200/45 sm:to-base-300/25">
          {idleNoChainAuction ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 border-b border-dashed border-secondary/25 px-3 py-6 text-center sm:border-b-0">
              <p className="text-sm text-base-content/55 font-medium">
                No live listing
              </p>
              <p className="text-[11px] text-base-content/40 leading-snug">
                Start or restart the auction on the right when the on-chain queue
                has a Warplet.
              </p>
            </div>
          ) : showSettleSkeleton || artworkSkeleton ? (
            <div className="relative mx-auto aspect-square w-[90%] min-h-0 overflow-hidden rounded-xl border border-base-content/15 bg-base-200/25 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.85)] sm:mx-0 sm:w-full sm:aspect-auto sm:flex-1 sm:rounded-l-[0.78rem] sm:rounded-r-none sm:border-0 sm:bg-transparent sm:shadow-none">
              <div className="skeleton absolute inset-0 min-h-0 w-full" />
            </div>
          ) : (
            <div className="relative mx-auto aspect-square w-[90%] min-h-0 overflow-hidden rounded-xl border border-base-content/15 bg-base-200/25 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.85)] sm:mx-0 sm:w-full sm:aspect-auto sm:flex-1 sm:rounded-l-[0.78rem] sm:rounded-r-none sm:border-0 sm:bg-transparent sm:shadow-none">
              <AuctionWarpletImage fid={displayTokenId} variant="hero" />
              <p className="absolute bottom-0 inset-x-0 z-[1] text-[10px] sm:text-xs lg:text-sm font-medium text-base-content/70 bg-black/50 backdrop-blur-sm py-1 sm:py-1.5 px-2 text-center m-0">
                Warplet #{displayTokenId}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 max-w-[min(100%,26rem)] flex-col gap-3 border-t-0 bg-transparent px-2 py-2 text-center sm:h-full sm:border-l sm:border-t-0 sm:border-base-content/10 sm:bg-base-100/20 sm:px-3.5 sm:py-3.5 lg:max-w-[28rem]">
            <div className="hidden shrink-0 border-b border-base-content/10 pb-2 sm:block">
              <h2 className="max-w-full truncate text-lg sm:text-xl lg:text-2xl font-bold tracking-tight uppercase text-secondary m-0 leading-tight">
                DAILY WARPLET AUCTION
              </h2>
              <p className="mx-auto max-w-xl text-[10px] sm:text-xs text-base-content/65 mt-1.5 mb-0 leading-snug">
                A Warplet a day keeps the Gobbler away. Bid to win.
              </p>
            </div>

              {showExtendSuccessBanner && !idleNoChainAuction && !sold ? (
                <div
                  className="w-full rounded-lg border border-primary/35 bg-primary/10 px-3 py-2.5 text-center shadow-[0_0_24px_-8px_rgba(0,245,255,0.35)] animate-fade-up shrink-0"
                  role="status"
                >
                  <p className="text-sm font-medium text-primary/95">
                    Listing extended
                  </p>
                  <p className="text-xs text-base-content/60 mt-1 leading-relaxed">
                    The chain has opened a fresh window — bidding picks up from
                    the updated countdown.
                  </p>
                </div>
              ) : null}

              <div
                ref={renewFlashRef}
                className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto transition-[box-shadow] duration-500"
              >
                <div
                  className={`flex min-h-0 w-full flex-1 flex-col transition-colors duration-500 ${
                    startNewAuction?.loading ? "animate-auction-tx-pending" : ""
                  }`}
                >
                  {showSettleSkeleton ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center text-center">
                      <div className="flex w-full shrink-0 flex-col items-center justify-center gap-2 py-1 mb-6 sm:mb-10">
                        <div className="skeleton mx-auto h-3 w-24 rounded-md" />
                        <div className="skeleton mx-auto h-11 w-44 max-w-full rounded-md sm:h-12" />
                      </div>
                      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 py-1">
                        <div className="flex w-full flex-col items-center gap-2">
                          <div className="skeleton mx-auto h-3 w-16 rounded-md" />
                          <div className="skeleton mx-auto h-10 w-48 max-w-full rounded-md sm:h-11" />
                          <div className="skeleton mx-auto h-2.5 w-[4.5rem] rounded-md opacity-80" />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <div className="skeleton h-2.5 w-5 shrink-0 rounded" />
                          <div className="skeleton h-10 w-44 max-w-full rounded-md" />
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col items-center text-center">
                      {/* Row 1 — countdown (extra space before bid block) */}
                      <div
                        className="flex w-full shrink-0 flex-col items-center justify-center py-2 sm:py-3 mb-6 sm:mb-10"
                        aria-live="polite"
                        aria-label="Time remaining in lot"
                      >
                        {!sold && !idleNoChainAuction ? (
                          <>
                            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                              {auctionExpiredOnChain ? "Ended" : "Time left"}
                            </p>
                            {countdownEndUnix !== undefined ? (
                              <CountdownTimer
                                key={countdownResetKey ?? String(countdownEndUnix)}
                                endUnix={countdownEndUnix}
                                className="block text-center text-3xl sm:text-4xl lg:text-5xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                              />
                            ) : countdownDurationSecs !== undefined ? (
                              <CountdownTimer
                                startSecs={countdownDurationSecs}
                                className="block text-center text-3xl sm:text-4xl lg:text-5xl font-mono font-semibold text-secondary tabular-nums tracking-tight"
                              />
                            ) : (
                              <span className="block text-center text-3xl sm:text-4xl lg:text-5xl font-mono font-semibold text-base-content/25 tabular-nums">
                                —:—:—
                              </span>
                            )}
                            {auctionExpiredOnChain ? (
                              <p className="mx-auto max-w-sm text-[10px] sm:text-[11px] text-warning/85 mt-1.5 leading-snug">
                                {!hasNextAuctionToken
                                  ? "Auction ended - settle to claim your NFT"
                                  : "Auction ended - start next auction to claim your NFT"}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      {/* Top bid + high bidder — one group; flex-1 eats height below countdown */}
                      <div
                        className={`flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 py-2 sm:py-3 ${
                          showNoBids &&
                          !sold &&
                          !idleNoChainAuction &&
                          !auctionExpiredOnChain
                            ? "min-h-[5rem] sm:min-h-[5.5rem]"
                            : ""
                        }`}
                      >
                        <div className="flex w-full flex-col items-center">
                          <p className="text-[10px] sm:text-xs uppercase tracking-wider text-base-content/45 mb-1">
                            {topBidUsdNotional != null
                              ? `Top bid: ${formatUsdSmallBelow(topBidUsdNotional)}`
                              : "Top bid"}
                          </p>
                          {idleNoChainAuction ? (
                            <div className="space-y-1">
                              <p className="text-2xl sm:text-3xl font-mono text-base-content/45">
                                —
                              </p>
                              {startNewAuction ? (
                                <p className="mx-auto max-w-sm text-xs text-base-content/50 leading-snug">
                                  Use <span className="text-secondary/90">Restart
                                  auction</span> to open the next lot from the queue.
                                </p>
                              ) : null}
                            </div>
                          ) : sold ? (
                            <div className="space-y-2">
                              <p
                                className={`text-3xl sm:text-4xl font-mono text-success transition-all duration-300 ${
                                  startNewAuction?.loading
                                    ? "scale-[1.02] drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                                    : ""
                                }`}
                              >
                                Settled
                              </p>
                              <p className="mx-auto max-w-sm text-xs text-base-content/50 leading-snug">
                                Auction complete.
                              </p>
                            </div>
                          ) : showNoBids ? (
                            <div className="flex flex-col items-center gap-2">
                              <p className="text-xl sm:text-2xl font-mono text-base-content/50">
                                No bids yet
                              </p>
                              {bidInviteCopy && !auctionExpiredOnChain ? (
                                <p className="mx-auto max-w-sm text-xs text-secondary/80 font-medium leading-snug">
                                  {bidInviteCopy}
                                </p>
                              ) : (
                                <span className="block min-h-[1.125rem]" aria-hidden />
                              )}
                            </div>
                          ) : (
                            <div className="flex w-full max-w-sm flex-col items-center px-1">
                              <p
                                ref={bidTopAmountRef}
                                data-symbol={bidSymbol}
                                aria-label={`${topBidAmountStr} ${bidSymbol}`}
                                className="bid-top-symbol-after m-0 text-center text-xl sm:text-2xl lg:text-3xl font-mono text-base-content tabular-nums tracking-tight"
                              >
                                {topBidAmountStr}
                              </p>
                            </div>
                          )}
                        </div>

                        {!sold && !showNoBids && hasHighBidder && topBidder ? (
                          <div
                            className="flex w-full max-w-sm min-w-0 items-center justify-center gap-1.5"
                            aria-label="High bidder"
                          >
                            <span className="shrink-0 text-[10px] sm:text-[11px] leading-none text-base-content/45">
                              by
                            </span>
                            <BidderAvatarName
                              address={topBidder}
                              viewerAddress={viewerAddress ?? undefined}
                              className="min-w-0"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  <div className="shrink-0 space-y-2 pt-1">
                  {contractPaused && !sold && !idleNoChainAuction && (
                    <p className="mx-auto max-w-md text-center text-xs text-warning/80">
                      Auction house is paused — bidding is disabled on-chain.
                    </p>
                  )}
                  </div>
                  </>
                  )}
                </div>
              </div>

              <div className="mt-auto w-full shrink-0 space-y-3 border-t border-base-content/10 pt-3 text-left sm:pt-2.5">
                {sold ? (
                  <>
                    <p
                      className={`text-sm transition-all duration-300 ${
                        startNewAuction?.loading
                          ? "text-secondary/75 animate-pulse font-medium"
                          : "text-base-content/40"
                      }`}
                    >
                      {settledFooterCopy ??
                        "The last auction has ended. Restart when the queue is ready."}
                    </p>
                    {startNewAuction ? (
                      <StartNewAuctionPanel cfg={startNewAuction} />
                    ) : null}
                  </>
                ) : showSettleSkeleton ? (
                  <SettlementProgressStrip stage={settleStage} />
                ) : chainSettlement ? (
                  <div className="space-y-2">
                    {chainSettlement.hint ? (
                      <p className="text-center text-xs text-base-content/45">
                        {chainSettlement.hint}
                      </p>
                    ) : null}
                    {chainSettlement.error ? (
                      <p className="text-center text-xs text-error/90 break-words">
                        {chainSettlement.error}
                      </p>
                    ) : null}
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
                  </div>
                ) : postAuctionNoActionHint ? (
                  <p className="text-center text-xs text-base-content/50 leading-relaxed">
                    {postAuctionNoActionHint}
                  </p>
                ) : chainBid ? (
                  <div className="space-y-2">
                    {chainBid.viewerBidTokenBalanceHuman != null ||
                    chainBid.nativeEthBid?.available ? (
                      <p className="text-[10px] text-base-content/45 px-0.5 flex items-center justify-end gap-1 text-right sm:hidden">
                        <span>
                          Balance:{" "}
                          {paymentMode === "eth"
                            ? (chainBid.viewerEthBalanceHuman ?? "--")
                            : (chainBid.viewerBidTokenBalanceHuman ?? "--")}
                        </span>
                        <button
                          type="button"
                          className={`font-semibold transition-colors ${
                            chainBid.nativeEthBid?.available
                              ? "text-secondary hover:text-secondary/80"
                              : "text-base-content/55"
                          }`}
                          onClick={handlePaymentModeToggle}
                          disabled={!chainBid.nativeEthBid?.available}
                        >
                          {paymentMode === "token" ? `$${bidSymbol}` : "$ETH"}
                        </button>
                        {paymentMode === "eth" &&
                        chainBid.nativeEthBid?.quoteError ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error normal-case ml-auto"
                            onClick={() => chainBid.nativeEthBid?.onRefreshQuote()}
                          >
                            Retry estimate
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                    <label className="form-control w-full">
                      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div
                          className={`flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md border border-base-content/15 bg-base-200/35 px-2 transition-colors focus-within:border-secondary/70 focus-within:bg-base-200/45 sm:flex-1 sm:px-0.5 sm:rounded-none sm:border-0 sm:border-b sm:border-base-content/20 sm:bg-transparent ${
                            chainBid.disabled ||
                            chainBid.loading ||
                            chainBid.minBidWei == null ||
                            chainBid.bidDecimals == null
                              ? "opacity-50 pointer-events-none"
                              : ""
                          }`}
                        >
                          <span
                            className="shrink-0 text-left text-xs sm:text-sm font-mono tabular-nums text-base-content/50 select-none"
                            title="Approximate USD (spot)"
                          >
                            {formatUsdTilde(bidUsdEstimate, 2)}
                          </span>
                          <input
                            ref={bidInputRef}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="min-w-0 flex-1 bg-transparent py-2 text-right font-mono text-lg sm:text-xl tabular-nums tracking-tight text-base-content placeholder:text-base-content/25 outline-none border-0 focus:ring-0"
                            value={
                              paymentMode === "eth"
                                ? (ethAmountDisplayRaw ||
                                  (chainBid.nativeEthBid?.txValueFormatted
                                    ? formatBidAmountDisplay(
                                        normalizeBidString(
                                          chainBid.nativeEthBid.txValueFormatted,
                                        ),
                                        ETH_INPUT_MAX_FRAC_DIGITS,
                                        BID_INPUT_MAX_INT_DIGITS,
                                      )
                                    : ""))
                                : bidAmountRaw
                            }
                            onChange={(e) => {
                              if (paymentMode === "eth") return;
                              const el = e.target;
                              const next = formatBidAmountDisplay(
                                normalizeBidString(el.value),
                                Math.min(
                                  chainBid.bidDecimals,
                                  TOKEN_INPUT_MAX_FRAC_DIGITS,
                                ),
                                BID_INPUT_MAX_INT_DIGITS,
                              );
                              setBidAmountRaw(next);
                              setBidValidationError(null);
                              chainBid.onClearTxError?.();
                              requestAnimationFrame(() => {
                                try {
                                  el.setSelectionRange(
                                    next.length,
                                    next.length,
                                  );
                                } catch {
                                  /* ignore */
                                }
                              });
                            }}
                            readOnly={paymentMode === "eth"}
                            disabled={
                              chainBid.disabled ||
                              chainBid.loading ||
                              chainBid.minBidWei == null ||
                              chainBid.bidDecimals == null
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleChainBidSubmit}
                          disabled={
                            bidDisabled ||
                            chainBlocksBid ||
                            nativeEthBlocksBid ||
                            chainBid.disabled ||
                            chainBid.loading ||
                            chainBid.minBidWei == null
                          }
                          className="btn btn-secondary w-full shrink-0 px-3 font-semibold tracking-wide disabled:opacity-50 sm:w-auto sm:min-w-[4.75rem]"
                        >
                          {chainBid.loading ? (
                            <span className="loading loading-spinner loading-sm" />
                          ) : (
                            "BID"
                          )}
                        </button>
                      </div>
                    </label>
                    {chainBid.viewerBidTokenBalanceHuman != null ||
                    chainBid.nativeEthBid?.available ? (
                      <p className="hidden text-[10px] text-base-content/45 px-0.5 items-center justify-end gap-1 text-right sm:flex sm:pr-[5.5rem]">
                        <span>
                          Balance:{" "}
                          {paymentMode === "eth"
                            ? (chainBid.viewerEthBalanceHuman ?? "--")
                            : (chainBid.viewerBidTokenBalanceHuman ?? "--")}
                        </span>
                        <button
                          type="button"
                          className={`font-semibold transition-colors ${
                            chainBid.nativeEthBid?.available
                              ? "text-secondary hover:text-secondary/80"
                              : "text-base-content/55"
                          }`}
                          onClick={handlePaymentModeToggle}
                          disabled={!chainBid.nativeEthBid?.available}
                        >
                          {paymentMode === "token" ? `$${bidSymbol}` : "$ETH"}
                        </button>
                        {paymentMode === "eth" &&
                        chainBid.nativeEthBid?.quoteError ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error normal-case ml-auto"
                            onClick={() => chainBid.nativeEthBid?.onRefreshQuote()}
                          >
                            Retry estimate
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                    {txOrValidationError ? (
                      <p className="text-xs text-error/90 text-left break-words px-0.5">
                        {txOrValidationError}
                      </p>
                    ) : null}
                  </div>
                ) : startNewAuction ? (
                  <StartNewAuctionPanel cfg={startNewAuction} />
                ) : idleNoChainAuction ? null : (
                  <button
                    ref={btnRef}
                    type="button"
                    onClick={handleDemoBid}
                    disabled={bidDisabled || chainBlocksBid}
                    className="btn btn-secondary w-full text-base font-semibold tracking-wide disabled:opacity-50"
                  >
                    Bid
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
    </div>
  );
}
