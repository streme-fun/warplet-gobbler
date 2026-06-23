"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatUnits, isAddressEqual, parseUnits, zeroAddress } from "viem";
import type { Address } from "viem";
import type { AuctionBidPaymentMode } from "@/lib/defaultAuctionBidPayment";
import { formatDuration } from "@/lib/format-duration";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";
import BuyWarpgobbLink from "./BuyWarpgobbLink";
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
        <p className="text-sm font-medium text-secondary/90">
          Settling auction
        </p>
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
  if (usd == null || !Number.isFinite(usd)) return "~$—";
  return `~$${usd.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  })}`;
}

/** Small USD line under top bid (~$ prefix, same rounding spirit as `formatUsdTilde`). */
function formatUsdSmallBelow(usd: number): string {
  return `~$${usd.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function connectWalletActionLabel(action: string): string {
  const formatted = action
    .trim()
    .split(/\s+/)
    .map((part) =>
      part.length === 0
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
  return `Connect Wallet to ${formatted}`;
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
function bidDisplayToParseable(
  displayed: string,
  maxFracDigits: number,
): string {
  const n = normalizeBidString(displayed);
  if (n === "" || n === ".") return "0";
  const idx = n.indexOf(".");
  if (idx === -1) return n.replace(/\D/g, "") || "0";
  const int = n.slice(0, idx).replace(/\D/g, "");
  const frac = n
    .slice(idx + 1)
    .replace(/\D/g, "")
    .slice(0, maxFracDigits);
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
const MIN_BID_VALIDATION_PREFIX = "Your bid must be at least ";

function formatBidTokenHumanDisplay(human: string, decimals: number): string {
  return formatBidAmountDisplay(
    trimDecimalDisplay(human),
    Math.min(decimals, TOKEN_INPUT_MAX_FRAC_DIGITS),
    BID_INPUT_MAX_INT_DIGITS,
  );
}

function formatBidTokenWeiDisplay(wei: bigint, decimals: number): string {
  return formatBidTokenHumanDisplay(formatUnits(wei, decimals), decimals);
}

function formatBidTokenWeiCeilDisplay(wei: bigint, decimals: number): string {
  if (wei <= 0n) return "0";
  const maxFracDigits = Math.min(decimals, TOKEN_INPUT_MAX_FRAC_DIGITS);
  const roundedUnitWei =
    decimals > maxFracDigits ? 10n ** BigInt(decimals - maxFracDigits) : 1n;
  const roundedWei =
    roundedUnitWei > 1n && wei % roundedUnitWei !== 0n
      ? ((wei / roundedUnitWei) + 1n) * roundedUnitWei
      : wei;
  return formatBidTokenWeiDisplay(roundedWei, decimals);
}

function formatEthWeiCeilDisplay(wei: bigint): string {
  if (wei <= 0n) return "";
  const roundedFracWei = 10n ** BigInt(18 - ETH_INPUT_MAX_FRAC_DIGITS);
  const roundedWei =
    wei % roundedFracWei === 0n
      ? wei
      : ((wei / roundedFracWei) + 1n) * roundedFracWei;
  return formatBidAmountDisplay(
    trimDecimalDisplay(formatUnits(roundedWei, 18)),
    ETH_INPUT_MAX_FRAC_DIGITS,
    BID_INPUT_MAX_INT_DIGITS,
  );
}

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
    spendBidWei?: bigint | null;
    spendQuoteLoading?: boolean;
    spendQuoteError?: string | null;
    onEthSpendWeiDebounced?: (wei: bigint | null) => void;
    onRefreshSpendQuote?: () => void;
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
  const { isDisconnected, isReconnecting, isConnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [pressPulse, setPressPulse] = useState(false);
  // While wagmi is restoring a session from storage, address is already known but
  // isConnected hasn't flipped yet. Don't show "Connect Wallet" or open the modal
  // in that window — opening the modal mid-reconnect collides with the in-flight
  // WalletConnect session and surfaces as "Connection Failed".
  const walletDisconnected = isDisconnected;
  const walletReconnecting = isReconnecting || isConnecting;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (cfg.loading) return;
          if (walletReconnecting) return;
          if (walletDisconnected) {
            openConnectModal?.();
            return;
          }
          if (cfg.disabled) return;
          setPressPulse(true);
          window.setTimeout(() => setPressPulse(false), 220);
          cfg.onStart();
        }}
        disabled={
          cfg.loading ||
          walletReconnecting ||
          (!walletDisconnected && cfg.disabled)
        }
        className={`gobble-btn-ghost-purple mx-auto !mt-3 flex w-full max-w-full items-center justify-center active:scale-[0.97] sm:!mt-5 sm:w-max ${
          walletDisconnected
            ? "!font-sans !tracking-normal !text-xs !font-semibold sm:!text-sm"
            : ""
        } ${pressPulse ? "scale-[0.98]" : ""}`}
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
        ) : walletDisconnected ? (
          "Connect Wallet to Start Next Auction"
        ) : (
          <>
            Start next auction
          </>
        )}
      </button>
      {cfg.queueBlockedReason ? (
        <p className="text-xs text-base-content/55 text-center leading-relaxed">
          {cfg.queueBlockedReason}
        </p>
      ) : null}
      {cfg.error ? (
        <p className="text-xs text-error/90 break-words text-center">
          {cfg.error}
        </p>
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
  auctionDurationSecs,
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
  /** Lot length from on-chain `startTime`/`endTime` or mock `endsSecs`. */
  auctionDurationSecs?: number;
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
  const userEditedEthAmountRef = useRef(false);
  const { isDisconnected, isReconnecting, isConnecting } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [bidAmountRaw, setBidAmountRaw] = useState("");
  const [ethAmountDisplayRaw, setEthAmountDisplayRaw] = useState("");
  const [bidValidationError, setBidValidationError] = useState<string | null>(
    null,
  );
  const [showExtendSuccessBanner, setShowExtendSuccessBanner] = useState(false);
  const [paymentMode, setPaymentMode] =
    useState<AuctionBidPaymentMode>("token");
  const hasChainBid = chainBid != null;
  const chainBidMinBidWei = chainBid?.minBidWei;
  const chainBidMinBidHuman = chainBid?.minBidHuman;
  const chainBidDecimals = chainBid?.bidDecimals;
  const chainBidDefaultPaymentMethod = chainBid?.defaultPaymentMethod;
  const chainBidParseHumanToWei = chainBid?.parseHumanToWei;
  const chainBidOnBidWeiDebounced = chainBid?.onBidWeiDebounced;
  const chainBidNativeEthAvailable = chainBid?.nativeEthBid?.available;
  const chainBidNativeEthQuoteLoading = chainBid?.nativeEthBid?.quoteLoading;
  const chainBidNativeEthTxValueWei = chainBid?.nativeEthBid?.txValueWei;
  const chainBidNativeEthTxValueFormatted =
    chainBid?.nativeEthBid?.txValueFormatted;
  const chainBidNativeEthOnRefreshQuote =
    chainBid?.nativeEthBid?.onRefreshQuote;
  const chainBidNativeEthOnEthSpendWeiDebounced =
    chainBid?.nativeEthBid?.onEthSpendWeiDebounced;

  const targetEthAmountDisplay = useMemo(() => {
    if (chainBidNativeEthTxValueWei != null) {
      return formatEthWeiCeilDisplay(chainBidNativeEthTxValueWei);
    }
    const quoted = chainBidNativeEthTxValueFormatted;
    if (!quoted) return "";
    return formatBidAmountDisplay(
      normalizeBidString(quoted),
      ETH_INPUT_MAX_FRAC_DIGITS,
      BID_INPUT_MAX_INT_DIGITS,
    );
  }, [chainBidNativeEthTxValueWei, chainBidNativeEthTxValueFormatted]);

  const ethInputWei = useMemo(() => {
    if (paymentMode !== "eth") return null;
    try {
      return parseUnits(
        bidDisplayToParseable(ethAmountDisplayRaw, ETH_INPUT_MAX_FRAC_DIGITS),
        18,
      );
    } catch {
      return null;
    }
  }, [paymentMode, ethAmountDisplayRaw]);

  const tokenInputBidWei = useMemo(() => {
    if (
      paymentMode !== "token" ||
      !chainBidParseHumanToWei ||
      chainBidDecimals == null
    ) {
      return null;
    }
    try {
      return chainBidParseHumanToWei(
        bidDisplayToParseable(bidAmountRaw, chainBidDecimals),
      );
    } catch {
      return null;
    }
  }, [paymentMode, bidAmountRaw, chainBidParseHumanToWei, chainBidDecimals]);

  const translatedEthBidWei =
    paymentMode === "eth" ? (chainBid?.nativeEthBid?.spendBidWei ?? null) : null;
  const effectiveBidWei =
    paymentMode === "eth" ? translatedEthBidWei : tokenInputBidWei;
  const minBidDisplay = useMemo(() => {
    if (chainBidDecimals == null) return null;
    if (chainBidMinBidWei != null) {
      return formatBidTokenWeiCeilDisplay(chainBidMinBidWei, chainBidDecimals);
    }
    if (chainBidMinBidHuman == null) return null;
    return formatBidTokenHumanDisplay(chainBidMinBidHuman, chainBidDecimals);
  }, [chainBidMinBidHuman, chainBidMinBidWei, chainBidDecimals]);
  const translatedEthBidDisplay = useMemo(() => {
    if (translatedEthBidWei == null || chainBidDecimals == null) return null;
    return formatBidTokenWeiDisplay(translatedEthBidWei, chainBidDecimals);
  }, [translatedEthBidWei, chainBidDecimals]);
  const belowMinimumBid = Boolean(
    chainBidMinBidWei != null &&
      effectiveBidWei != null &&
      effectiveBidWei < chainBidMinBidWei,
  );

  const chainBlocksBid = Boolean(
    contractPaused || auctionExpiredOnChain || idleNoChainAuction,
  );
  const nativeEthBlocksBid = Boolean(
    paymentMode === "eth" &&
    chainBid?.nativeEthBid?.available === true &&
    (ethInputWei == null ||
      ethInputWei <= 0n ||
      chainBid.nativeEthBid.spendBidWei == null ||
      (chainBid.nativeEthBid.spendQuoteLoading &&
        chainBid.nativeEthBid.spendBidWei == null)),
  );

  const bidUsdEstimate = useMemo(() => {
    const spot = chainBid?.bidTokenPriceUsd;
    const dec = chainBid?.bidDecimals;
    if (spot == null || !Number.isFinite(spot) || spot <= 0 || dec == null) {
      return null;
    }
    if (paymentMode === "eth") {
      const spendBidWei = chainBid?.nativeEthBid?.spendBidWei;
      if (spendBidWei == null || spendBidWei <= 0n) return null;
      const n = Number.parseFloat(formatUnits(spendBidWei, dec));
      if (!Number.isFinite(n) || n < 0) return null;
      return n * spot;
    }
    const raw = bidDisplayToParseable(bidAmountRaw, dec);
    if (raw === "" || raw === "0") return null;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n * spot;
  }, [
    paymentMode,
    bidAmountRaw,
    chainBid?.bidTokenPriceUsd,
    chainBid?.bidDecimals,
    chainBid?.nativeEthBid?.spendBidWei,
  ]);

  const insufficientBalance = useMemo(() => {
    if (paymentMode === "eth") {
      const bal = chainBid?.viewerEthBalanceHuman;
      if (bal == null) return false;
      const bidNum = Number.parseFloat(
        bidDisplayToParseable(ethAmountDisplayRaw, ETH_INPUT_MAX_FRAC_DIGITS),
      );
      const balNum = Number.parseFloat(bal.replace(/,/g, ""));
      if (!Number.isFinite(bidNum) || !Number.isFinite(balNum)) return false;
      return bidNum > balNum;
    }
    const bal = chainBid?.viewerBidTokenBalanceHuman;
    const dec = chainBid?.bidDecimals;
    if (bal == null || dec == null) return false;
    const bidNum = Number.parseFloat(bidDisplayToParseable(bidAmountRaw, dec));
    const balNum = Number.parseFloat(bal.replace(/,/g, ""));
    if (!Number.isFinite(bidNum) || !Number.isFinite(balNum)) return false;
    return bidNum > balNum;
  }, [
    paymentMode,
    bidAmountRaw,
    ethAmountDisplayRaw,
    chainBid?.viewerBidTokenBalanceHuman,
    chainBid?.viewerEthBalanceHuman,
    chainBid?.bidDecimals,
  ]);

  useEffect(() => {
    if (chainBidMinBidWei == null || chainBidDecimals == null) return;
    let chosen: bigint;
    try {
      const floor = parseUnits(DEFAULT_BID_FLOOR_HUMAN, chainBidDecimals);
      chosen = chainBidMinBidWei > floor ? chainBidMinBidWei : floor;
    } catch {
      chosen = chainBidMinBidWei;
    }
    try {
      setBidAmountRaw(formatBidTokenWeiCeilDisplay(chosen, chainBidDecimals));
    } catch {
      if (chainBidMinBidHuman != null) {
        setBidAmountRaw(
          formatBidAmountDisplay(
            trimDecimalDisplay(chainBidMinBidHuman),
            Math.min(chainBidDecimals, TOKEN_INPUT_MAX_FRAC_DIGITS),
            BID_INPUT_MAX_INT_DIGITS,
          ),
        );
      }
    }
    setBidValidationError(null);
  }, [chainBidMinBidWei, chainBidDecimals, chainBidMinBidHuman]);

  useEffect(() => {
    if (!hasChainBid) return;
    const nativeAvailable = chainBidNativeEthAvailable === true;
    if (!nativeAvailable) {
      setPaymentMode("token");
      userSelectedPaymentModeRef.current = false;
      return;
    }
    if (!userSelectedPaymentModeRef.current) {
      setPaymentMode(chainBidDefaultPaymentMethod ?? "token");
    }
  }, [hasChainBid, chainBidDefaultPaymentMethod, chainBidNativeEthAvailable]);

  useEffect(() => {
    // New lot -> re-apply automatic default until user switches again.
    userSelectedPaymentModeRef.current = false;
    userEditedEthAmountRef.current = false;
  }, [displayTokenId]);

  useEffect(() => {
    // A new required bid should reset ETH to the new automatic quote.
    userEditedEthAmountRef.current = false;
  }, [chainBidMinBidWei]);

  useEffect(() => {
    if (
      !chainBidOnBidWeiDebounced ||
      !chainBidParseHumanToWei ||
      chainBidDecimals == null
    )
      return;
    const id = window.setTimeout(() => {
      try {
        const wei = chainBidParseHumanToWei(
          bidDisplayToParseable(bidAmountRaw, chainBidDecimals),
        );
        chainBidOnBidWeiDebounced(wei);
      } catch {
        // ignore invalid intermediate input
      }
    }, 220);
    return () => window.clearTimeout(id);
  }, [
    bidAmountRaw,
    chainBidOnBidWeiDebounced,
    chainBidParseHumanToWei,
    chainBidDecimals,
  ]);

  useEffect(() => {
    if (paymentMode !== "eth") return;
    if (userEditedEthAmountRef.current) return;
    if (!targetEthAmountDisplay) return;
    setEthAmountDisplayRaw(targetEthAmountDisplay);
  }, [paymentMode, targetEthAmountDisplay]);

  useEffect(() => {
    if (paymentMode !== "eth") {
      chainBidNativeEthOnEthSpendWeiDebounced?.(null);
      return;
    }
    if (!chainBidNativeEthOnEthSpendWeiDebounced) return;
    const id = window.setTimeout(() => {
      try {
        const wei = parseUnits(
          bidDisplayToParseable(
            ethAmountDisplayRaw,
            ETH_INPUT_MAX_FRAC_DIGITS,
          ),
          18,
        );
        chainBidNativeEthOnEthSpendWeiDebounced(wei > 0n ? wei : null);
      } catch {
        chainBidNativeEthOnEthSpendWeiDebounced(null);
      }
    }, 220);
    return () => window.clearTimeout(id);
  }, [
    paymentMode,
    ethAmountDisplayRaw,
    chainBidNativeEthOnEthSpendWeiDebounced,
  ]);

  useEffect(() => {
    if (paymentMode !== "eth") return;
    if (!chainBidNativeEthAvailable) return;
    if (chainBidNativeEthQuoteLoading) return;
    if (chainBidNativeEthTxValueWei != null) return;
    chainBidNativeEthOnRefreshQuote?.();
  }, [
    paymentMode,
    chainBidNativeEthAvailable,
    chainBidNativeEthQuoteLoading,
    chainBidNativeEthTxValueWei,
    chainBidNativeEthOnRefreshQuote,
  ]);

  useEffect(() => {
    if (!bidValidationError?.startsWith(MIN_BID_VALIDATION_PREFIX)) return;
    setBidValidationError(null);
  }, [effectiveBidWei, chainBidMinBidWei, bidValidationError]);

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
      chainBid.bidDecimals == null
    ) {
      setBidValidationError("Loading…");
      return;
    }
    setBidValidationError(null);
    chainBid.onClearTxError?.();

    let wei: bigint;
    let ethTxValueWei: bigint | null = null;
    if (paymentMode === "eth") {
      try {
        ethTxValueWei = parseUnits(
          bidDisplayToParseable(
            ethAmountDisplayRaw,
            ETH_INPUT_MAX_FRAC_DIGITS,
          ),
          18,
        );
      } catch {
        setBidValidationError("Enter a valid amount in ETH.");
        return;
      }
      if (ethTxValueWei <= 0n) {
        setBidValidationError("Enter a valid amount in ETH.");
        return;
      }
      const spendBidWei = chainBid.nativeEthBid?.spendBidWei ?? null;
      if (spendBidWei == null || spendBidWei <= 0n) {
        setBidValidationError("ETH estimate unavailable. Try refresh estimate.");
        return;
      }
      wei = spendBidWei;
    } else {
      try {
        wei = chainBid.parseHumanToWei(
          bidDisplayToParseable(bidAmountRaw, chainBid.bidDecimals),
        );
      } catch {
        setBidValidationError(`Enter a valid amount in ${bidSymbol}.`);
        return;
      }
    }
    if (wei < chainBid.minBidWei) {
      const minShown = formatBidTokenWeiCeilDisplay(
        chainBid.minBidWei,
        chainBid.bidDecimals,
      );
      setBidValidationError(
        `${MIN_BID_VALIDATION_PREFIX}${minShown} ${bidSymbol}.`,
      );
      return;
    }

    if (paymentMode === "eth") {
      if (ethTxValueWei == null || ethTxValueWei <= 0n) {
        setBidValidationError("Enter a valid amount in ETH.");
        return;
      }
      await chainBid.onSubmit(wei, { payment: "eth", txValueWei: ethTxValueWei });
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
      userEditedEthAmountRef.current = false;
      if (targetEthAmountDisplay) {
        setEthAmountDisplayRaw(targetEthAmountDisplay);
      } else {
        chainBid.nativeEthBid?.onRefreshQuote();
      }
    } else {
      userEditedEthAmountRef.current = false;
      chainBid.nativeEthBid?.onEthSpendWeiDebounced?.(null);
    }
  };

  const sold = auctionSettled;

  const auctionSubtitle = "A Warplet a day keeps the Gobbler away. Bid to win.";
  const hasHighBidder =
    topBidder != null && !isAddressEqual(topBidder, zeroAddress);
  const hasNextAuctionToken = Boolean(
    startNewAuction && !startNewAuction.queueBlockedReason,
  );
  const activeEthQuoteError =
    paymentMode === "eth"
      ? (chainBid?.nativeEthBid?.spendQuoteError ??
        chainBid?.nativeEthBid?.quoteError ??
        null)
      : null;
  const displayedEthAmount =
    userEditedEthAmountRef.current || ethAmountDisplayRaw
      ? ethAmountDisplayRaw
      : targetEthAmountDisplay;
  const ethDefaultQuotePending = Boolean(
    paymentMode === "eth" &&
      chainBid?.nativeEthBid?.available &&
      chainBid.nativeEthBid.quoteLoading &&
      !displayedEthAmount,
  );
  const ethTranslationPending = Boolean(
    paymentMode === "eth" &&
      chainBid?.nativeEthBid?.available &&
      ethInputWei != null &&
      ethInputWei > 0n &&
      chainBid.nativeEthBid.spendQuoteLoading &&
      chainBid.nativeEthBid.spendBidWei == null,
  );
  const ethEstimatePending = ethDefaultQuotePending || ethTranslationPending;
  const belowMinimumButtonCopy =
    paymentMode === "eth" && translatedEthBidDisplay
      ? `~${translatedEthBidDisplay} $${bidSymbol}`
      : "Below Minimum";
  const belowMinimumButtonHint =
    minBidDisplay != null ? `min ${minBidDisplay} $${bidSymbol}` : null;
  const balanceLine =
    chainBid &&
    (chainBid.viewerBidTokenBalanceHuman != null ||
      chainBid.nativeEthBid?.available) ? (
      <p className="flex min-h-5 items-center justify-end gap-1.5 px-0.5 text-right text-[10px] text-base-content/45 sm:text-xs">
        <span>
          Balance:{" "}
          {paymentMode === "eth"
            ? (chainBid.viewerEthBalanceHuman ?? "--")
            : (chainBid.viewerBidTokenBalanceHuman ?? "--")}
        </span>
        {chainBid.nativeEthBid?.available ? (
          <button
            type="button"
            className="group inline-flex items-center gap-1 rounded-sm font-semibold leading-none text-secondary transition-colors hover:text-secondary/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-secondary/60"
            onClick={handlePaymentModeToggle}
            aria-label={`Switch bid currency to ${
              paymentMode === "token" ? "ETH" : bidSymbol
            }`}
          >
            <span>{paymentMode === "token" ? `$${bidSymbol}` : "$ETH"}</span>
            <svg
              className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:h-3.5 sm:w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 4v16m0 0l-3-3m3 3l3-3" />
              <path d="M17 20V4m0 0l-3 3m3-3l3 3" />
            </svg>
          </button>
        ) : (
          <BuyWarpgobbLink className="font-semibold text-base-content/55">
            {`$${bidSymbol}`}
          </BuyWarpgobbLink>
        )}
        {paymentMode === "eth" && activeEthQuoteError ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-1 h-auto min-h-0 px-1 py-0 text-error normal-case"
            onClick={() => {
              const refreshSpend = chainBid.nativeEthBid?.onRefreshSpendQuote;
              if (refreshSpend) refreshSpend();
              else chainBid.nativeEthBid?.onRefreshQuote();
            }}
          >
            Retry estimate
          </button>
        ) : null}
      </p>
    ) : null;

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
  // See StartNewAuctionPanel: gate on isDisconnected (terminal state) so we
  // don't flash "Connect Wallet" or open the modal during wagmi rehydration.
  const walletDisconnected = isDisconnected;
  const walletReconnecting = isReconnecting || isConnecting;
  const openConnectWallet = () => {
    if (walletReconnecting) return;
    openConnectModal?.();
  };

  return (
    <div
      ref={cardRevealRef}
      className="px-0 py-4 transition-shadow duration-300 sm:px-4 sm:py-8"
    >
      <div className="auction-warplet-aura">
        <div className="mx-auto grid w-full max-w-96 grid-cols-[minmax(8.75rem,0.9fr)_minmax(0,1fr)] gap-0 overflow-hidden rounded-[0.82rem] border border-secondary/25 bg-base-100/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_18px_48px_-30px_rgba(0,0,0,0.9)] sm:max-w-none sm:grid-cols-[minmax(272px,2.4fr)_minmax(17rem,2fr)] sm:items-stretch sm:bg-base-100/25">
          {/* Left — square art (~20% narrower track than prior 3fr); never squashed */}
          <div className="relative isolate flex w-full flex-col bg-gradient-to-br from-base-200/45 to-base-300/25 min-h-0 h-full">
            {idleNoChainAuction ? (
              <div className="flex h-full min-h-[10.5rem] w-full flex-col items-center justify-center gap-1.5 px-2 py-4 text-center sm:aspect-square sm:min-h-0">
                <p className="text-sm text-base-content/55 font-medium">
                  No live listing
                </p>
                <p className="text-[10px] text-base-content/40 leading-snug sm:text-[11px]">
                  Start or restart the auction on the right when the on-chain
                  queue has a Warplet.
                </p>
              </div>
            ) : showSettleSkeleton || artworkSkeleton ? (
              <div className="relative h-full min-h-[10.5rem] w-full overflow-hidden rounded-l-[0.78rem] bg-transparent sm:min-h-0 sm:flex-1">
                <div className="skeleton absolute inset-0 min-h-0 w-full" />
              </div>
            ) : (
              <div className="relative h-full min-h-[10.5rem] w-full overflow-hidden rounded-l-[0.78rem] bg-transparent sm:aspect-square sm:h-auto sm:min-h-0">
                <AuctionWarpletImage fid={displayTokenId} variant="hero" />
                <p className="absolute bottom-0 inset-x-0 z-[1] text-[10px] sm:text-xs lg:text-sm font-medium text-base-content/70 bg-black/50 backdrop-blur-sm py-1 sm:py-1.5 px-2 text-center m-0">
                  Warplet #{displayTokenId}
                </p>
              </div>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col items-center gap-1 bg-base-100/35 px-2.5 pb-1 pt-1.5 text-center sm:h-full sm:max-w-[26rem] sm:gap-3 sm:bg-base-100/20 sm:px-3.5 sm:pb-3.5 sm:pt-3.5 lg:max-w-[28rem]">
            <div className="shrink-0 pb-1 text-center sm:hidden">
              <h2 className="font-creepster gobble-title-shadow m-0 max-w-full truncate text-2xl font-normal uppercase leading-tight tracking-wide text-secondary">
                Warplet auction
              </h2>
            </div>
            <div className="hidden shrink-0 border-b border-base-content/10 pb-2 sm:block">
              <h2 className="font-creepster gobble-title-shadow max-w-full truncate text-2xl sm:text-3xl lg:text-4xl font-normal tracking-wide uppercase text-secondary m-0 leading-tight">
                WARPLET AUCTION
              </h2>
              <p className="mx-auto max-w-xl text-[10px] sm:text-xs text-base-content/65 mt-1.5 mb-0 leading-snug">
                {auctionSubtitle}
              </p>
            </div>

            <div
              ref={renewFlashRef}
              className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto transition-[box-shadow] duration-500"
            >
              <div
                className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center transition-colors duration-500 ${
                  startNewAuction?.loading ? "animate-auction-tx-pending" : ""
                }`}
              >
                {showSettleSkeleton ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
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
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                      {/* Row 1 — countdown (extra space before bid block) */}
                      {!sold && !idleNoChainAuction ? (
                        <div
                          className="flex w-full shrink-0 flex-col items-center justify-start py-1 sm:py-2"
                          aria-live="polite"
                          aria-label="Time remaining in lot"
                        >
                          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-base-content/45 sm:mb-1 sm:text-xs">
                            {auctionExpiredOnChain ? "Ended" : "Time left"}
                          </p>
                          {countdownEndUnix !== undefined ? (
                            <CountdownTimer
                              key={
                                countdownResetKey ?? String(countdownEndUnix)
                              }
                              endUnix={countdownEndUnix}
                              className="block text-center font-mono text-2xl font-semibold tracking-tight text-secondary tabular-nums sm:text-4xl lg:text-5xl"
                            />
                          ) : countdownDurationSecs !== undefined ? (
                            <CountdownTimer
                              startSecs={countdownDurationSecs}
                              className="block text-center font-mono text-2xl font-semibold tracking-tight text-secondary tabular-nums sm:text-4xl lg:text-5xl"
                            />
                          ) : (
                            <span className="block text-center font-mono text-2xl font-semibold text-base-content/25 tabular-nums sm:text-4xl lg:text-5xl">
                              —:—:—
                            </span>
                          )}
                          {auctionDurationSecs != null &&
                          !auctionExpiredOnChain ? (
                            <p className="mt-0.5 text-[10px] text-base-content/40 sm:text-[11px]">
                              of {formatDuration(auctionDurationSecs)} round
                            </p>
                          ) : null}
                          {auctionExpiredOnChain ? (
                            <p className="mx-auto max-w-sm text-[10px] sm:text-[11px] text-warning/85 mt-1.5 leading-snug">
                              {(() => {
                                const viewerIsWinner =
                                  topBidder != null &&
                                  viewerAddress != null &&
                                  !isAddressEqual(topBidder, zeroAddress) &&
                                  isAddressEqual(topBidder, viewerAddress);
                                if (viewerIsWinner) {
                                  return !hasNextAuctionToken
                                    ? "Auction ended — settle to claim your NFT"
                                    : "Auction ended — start next auction to claim your NFT";
                                }
                                return "Auction ended — awaiting settlement";
                              })()}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Top bid + high bidder — one group; flex-1 eats height below countdown */}
                      <div
                        className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 py-1 sm:gap-1 sm:py-3 ${
                          showNoBids &&
                          !sold &&
                          !idleNoChainAuction &&
                          !auctionExpiredOnChain
                            ? "min-h-[5rem] sm:min-h-[5.5rem]"
                            : ""
                        }`}
                      >
                        <div className="flex w-full flex-col items-center">
                          {sold &&
                          startNewAuction?.queueBlockedReason &&
                          walletDisconnected ? (
                            <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 px-2 py-3 text-center">
                              <p className="text-xs font-medium leading-snug text-base-content/60 sm:text-sm">
                                Queue empty — sell a Warplet to the Gobbler.
                              </p>
                              <button
                                type="button"
                                onClick={openConnectWallet}
                                className="gobble-btn-ghost-purple flex w-full max-w-56 items-center justify-center !font-sans !text-xs !font-semibold !tracking-normal active:scale-[0.97] sm:!text-sm"
                              >
                                Connect your wallet
                              </button>
                            </div>
                          ) : sold &&
                            startNewAuction?.queueBlockedReason ? null : (
                            <>
                              {!sold ? (
                                <p className="mb-0.5 text-[10px] uppercase tracking-wider text-base-content/45 sm:mb-1 sm:text-xs">
                                  {topBidUsdNotional != null
                                    ? `Top bid ${formatUsdSmallBelow(topBidUsdNotional)}`
                                    : "Top bid"}
                                </p>
                              ) : null}
                              {idleNoChainAuction ? (
                                <div className="space-y-1">
                                  <p className="font-mono text-2xl text-base-content/45 sm:text-3xl">
                                    —
                                  </p>
                                  {startNewAuction ? (
                                    <p className="mx-auto max-w-sm text-xs text-base-content/50 leading-snug">
                                      Use{" "}
                                      <span className="text-secondary/90">
                                        Start next auction
                                      </span>{" "}
                                      to open the next lot from the queue.
                                    </p>
                                  ) : null}
                                </div>
                              ) : sold ? (
                                <p
                                  className={`text-base sm:text-2xl font-mono uppercase tracking-wide text-success transition-all duration-300 ${
                                    startNewAuction?.loading
                                      ? "scale-[1.02] drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                                      : ""
                                  }`}
                                >
                                  Complete
                                </p>
                              ) : showNoBids ? (
                                <div className="flex flex-col items-center gap-2">
                                  <p className="font-mono text-base text-base-content/50 sm:text-2xl">
                                    No bids yet
                                  </p>
                                  {bidInviteCopy && !auctionExpiredOnChain ? (
                                    <p className="mx-auto max-w-sm text-xs text-secondary/80 font-medium leading-snug">
                                      {bidInviteCopy}
                                    </p>
                                  ) : (
                                    <span
                                      className="block min-h-[1.125rem]"
                                      aria-hidden
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="flex w-full max-w-sm flex-col items-center px-1">
                                  <p
                                    ref={bidTopAmountRef}
                                    aria-label={`${topBidAmountStr} ${bidSymbol}`}
                                    className="m-0 text-center font-mono text-lg tracking-tight text-base-content tabular-nums sm:text-2xl lg:text-3xl"
                                  >
                                    {topBidAmountStr}
                                    <BuyWarpgobbLink className="ml-1.5 inline-block -translate-y-[0.06em] font-sans text-[11px] font-medium leading-none tracking-normal text-base-content/40 sm:text-[12px]">
                                      {`$${bidSymbol}`}
                                    </BuyWarpgobbLink>
                                  </p>
                                </div>
                              )}
                            </>
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
                              size="xs"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 space-y-2 pt-1">
                      {contractPaused && !sold && !idleNoChainAuction && (
                        <p className="mx-auto max-w-md text-center text-xs text-warning/80">
                          Auction house is paused — bidding is disabled
                          on-chain.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-auto w-full shrink-0 space-y-1.5 text-center sm:space-y-3">
              {sold ? (
                <>
                  {settledFooterCopy ? (
                    <p
                      className={`mt-3 text-[10px] sm:mt-5 sm:text-sm transition-all duration-300 ${
                        startNewAuction?.loading
                          ? "text-secondary/75 animate-pulse font-medium"
                          : "text-base-content/40"
                      }`}
                    >
                      {(() => {
                        const parts = settledFooterCopy.split(/\.\s+/);
                        if (parts.length < 2) return settledFooterCopy;
                        return parts.map((part, i) => {
                          const text = i < parts.length - 1 ? `${part}.` : part;
                          return (
                            <span key={i}>
                              {i > 0 ? (
                                <>
                                  <br className="sm:hidden" />
                                  <span className="hidden sm:inline"> </span>
                                </>
                              ) : null}
                              {text}
                            </span>
                          );
                        });
                      })()}
                    </p>
                  ) : null}
                  {startNewAuction ? (
                    startNewAuction.queueBlockedReason ? (
                      walletDisconnected ? null : (
                        <p className="text-[10px] sm:text-xs text-base-content/50 leading-snug text-center">
                          {startNewAuction.queueBlockedReason}
                        </p>
                      )
                    ) : (
                      <StartNewAuctionPanel cfg={startNewAuction} />
                    )
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
                    onClick={() =>
                      walletDisconnected
                        ? openConnectWallet()
                        : void chainSettlement.onSubmit()
                    }
                    disabled={
                      chainSettlement.loading ||
                      (!walletDisconnected && chainSettlement.disabled)
                    }
                    className="gobble-btn-ghost-purple w-full"
                  >
                    {chainSettlement.loading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : walletDisconnected ? (
                      connectWalletActionLabel(chainSettlement.label)
                    ) : (
                      chainSettlement.label
                    )}
                  </button>
                </div>
              ) : postAuctionNoActionHint ? (
                <p className="text-center text-xs text-base-content/50 leading-relaxed">
                  {postAuctionNoActionHint}
                </p>
              ) : chainBid ? null : startNewAuction ? (
                <StartNewAuctionPanel cfg={startNewAuction} />
              ) : idleNoChainAuction ? null : (
                <button
                  ref={btnRef}
                  type="button"
                  onClick={walletDisconnected ? openConnectWallet : handleDemoBid}
                  disabled={
                    !walletDisconnected && (bidDisabled || chainBlocksBid)
                  }
                  className="gobble-btn-ghost-purple w-full"
                >
                  {walletDisconnected ? "Connect Wallet to Bid" : "Bid"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {chainBid ? (
        <div className="mx-auto mt-6 w-full max-w-96 space-y-2 px-2 sm:mt-8 sm:max-w-none sm:px-4">
          <label className="form-control w-full">
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div
                  className={`group flex min-h-12 w-full min-w-0 items-center gap-2 rounded-lg border border-base-content/15 bg-base-200/50 px-3 shadow-inner transition-colors focus-within:border-secondary/70 focus-within:bg-base-200/60 focus-within:shadow-[inset_0_0_0_1px_rgba(123,97,255,0.25)] sm:min-h-10 sm:rounded-none sm:border-0 sm:border-b sm:border-base-content/20 sm:bg-transparent sm:px-0.5 sm:shadow-none sm:focus-within:shadow-none ${
                    chainBid.disabled ||
                    chainBid.loading ||
                    chainBid.minBidWei == null ||
                    chainBid.bidDecimals == null
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  <span
                    className="shrink-0 select-none text-left font-mono text-xs text-base-content/40 tabular-nums sm:text-sm sm:text-base-content/50"
                    title="Approximate USD (spot)"
                  >
                    {formatUsdTilde(bidUsdEstimate, 2)}
                  </span>
                  <input
                    ref={bidInputRef}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 bg-transparent py-2 text-right font-mono text-base tracking-tight text-base-content tabular-nums outline-none placeholder:text-base-content/25 focus:ring-0 sm:text-xl"
                    placeholder={
                      paymentMode === "eth" && ethDefaultQuotePending
                        ? "Estimating ETH..."
                        : "0"
                    }
                    value={
                      paymentMode === "eth"
                        ? displayedEthAmount
                        : bidAmountRaw
                    }
                    onChange={(e) => {
                      const el = e.target;
                      const maxFracDigits =
                        paymentMode === "eth"
                          ? ETH_INPUT_MAX_FRAC_DIGITS
                          : Math.min(
                              chainBid.bidDecimals,
                              TOKEN_INPUT_MAX_FRAC_DIGITS,
                            );
                      const next = formatBidAmountDisplay(
                        normalizeBidString(el.value),
                        maxFracDigits,
                        BID_INPUT_MAX_INT_DIGITS,
                      );
                      if (paymentMode === "eth") {
                        userEditedEthAmountRef.current = true;
                        setEthAmountDisplayRaw(next);
                      } else {
                        setBidAmountRaw(next);
                      }
                      setBidValidationError(null);
                      chainBid.onClearTxError?.();
                      requestAnimationFrame(() => {
                        try {
                          el.setSelectionRange(next.length, next.length);
                        } catch {
                          /* ignore */
                        }
                      });
                    }}
                    disabled={
                      chainBid.disabled ||
                      chainBid.loading ||
                      chainBid.minBidWei == null ||
                      chainBid.bidDecimals == null
                    }
                  />
                </div>
                {balanceLine}
              </div>
              <button
                type="button"
                onClick={
                  walletDisconnected ? openConnectWallet : handleChainBidSubmit
                }
                disabled={
                  chainBid.loading ||
                  (!walletDisconnected &&
                    (bidDisabled ||
                      chainBlocksBid ||
                      nativeEthBlocksBid ||
                      belowMinimumBid ||
                      insufficientBalance ||
                      chainBid.disabled ||
                      chainBid.minBidWei == null))
                }
                className={`gobble-btn-ghost-purple w-full shrink-0 sm:w-auto ${
                  belowMinimumBid
                    ? "!text-base !tracking-[1px] sm:!text-lg"
                    : "!text-xl !tracking-[2px] sm:!text-2xl"
                }`}
              >
                {chainBid.loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : walletDisconnected ? (
                  "Connect Wallet to Bid"
                ) : insufficientBalance ? (
                  paymentMode === "eth" ? "Not Enough ETH" : "Insufficient Balance"
                ) : ethEstimatePending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="loading loading-spinner loading-sm" />
                    <span>Estimating ETH</span>
                  </span>
                ) : belowMinimumBid ? (
                  <span className="flex flex-col items-center justify-center leading-tight">
                    <span>{belowMinimumButtonCopy}</span>
                    {belowMinimumButtonHint ? (
                      <span className="mt-0.5 font-sans text-[10px] font-semibold normal-case tracking-normal text-base-content/70 sm:text-xs">
                        {belowMinimumButtonHint}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <>
                    Bid{" "}
                    {paymentMode === "eth"
                      ? `${displayedEthAmount || "0"} ETH`
                      : `${bidAmountRaw || "0"} $${bidSymbol}`}
                  </>
                )}
              </button>
            </div>
          </label>
          {txOrValidationError ? (
            <p className="text-xs text-error/90 text-left break-words px-0.5">
              {txOrValidationError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
