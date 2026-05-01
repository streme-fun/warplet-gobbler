"use client";

import type { Address } from "viem";
import { formatUnits, isAddressEqual, zeroAddress } from "viem";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount, useBalance, usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import AuctionLiveHero from "./AuctionLiveHero";
import AuctionWinnerClaimGate from "./AuctionWinnerClaimGate";
import {
  addDismissedFp,
  appendSettlementRecord,
  getWinnerFingerprint,
  LastAuctionSettlementStack,
  pickDisplaySettlementRows,
  readDismissedFpArray,
  readSettlementHistory,
  SETTLEMENT_DISPLAY_LIMIT,
  sortSettlementsForDisplay,
  type ClaimAction,
  type SettlementRecord,
  type StoredWinnerHighlight,
} from "./LastAuctionWinnerBanner";
import AuctionQueueCard from "./AuctionQueueCard";
import AuctionQueueCardSkeleton from "./AuctionQueueCardSkeleton";
import AuctionQueueBumpPanel from "./AuctionQueueBumpPanel";
import AuctionQueueHeadSlot, {
  type QueueBumpHeadPhase,
} from "./AuctionQueueHeadSlot";
import BidFeedbackOverlay from "./BidFeedbackOverlay";
import QueueBumpCutStrip from "./QueueBumpCutStrip";
import QueueStripCellChrome from "./QueueStripCellChrome";
import {
  useAuctionSellAuction,
  type AuctionSellLot,
} from "@/hooks/useAuctionSell";
import { useAuctionSellBid } from "@/hooks/useAuctionSellBid";
import { useStremeEthBidQuote } from "@/hooks/useStremeEthBidQuote";
import { useAuctionSellSettleActions } from "@/hooks/useAuctionSellSettle";
import { useAuctionSellStartAuction } from "@/hooks/useAuctionSellStartAuction";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { useAuctionQueueBump } from "@/hooks/useAuctionQueueBump";
import { useGobbledRescue } from "@/hooks/useGobbledRescue";
import { useWarpgobbUsdPrice } from "@/hooks/useDutchAuction";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { defaultAuctionBidPaymentMethod } from "@/lib/defaultAuctionBidPayment";
import { formatUserFacingTxError } from "@/lib/format-tx-error";
import {
  DEV_MOCK_EXTRA_QUEUE_TOKEN_IDS,
  DEV_MOCK_QUEUE_APPEND_EXTRAS,
  DEV_MOCK_QUEUE_BUMP_LOCAL,
  DEV_MOCK_QUEUE_SKIP_CTA_DISABLED,
  MOCK_AUCTIONS,
  MOCK_FALLBACK_TOP_BID_AMOUNT,
  MOCK_FALLBACK_TOP_BIDDER,
} from "@/lib/mock-data";

/** First occurrence wins — duplicate token ids break selection / bump index logic. */
function dedupeQueueTokenIds(ids: bigint[]): bigint[] {
  const seen = new Set<string>();
  const out: bigint[] = [];
  for (const id of ids) {
    const k = id.toString();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}

/** Mock/local bump: fade at source → scroll + head preview → empty slot + strip land. */
const BUMP_FADE_SOURCE_MS = Math.round(420 * 1.2 * 1.2 * 0.9);
const BUMP_HEAD_PREVIEW_MS = Math.round(680 * 1.2 * 1.2 * 0.9);
const BUMP_FINALIZE_MS = Math.round(540 * 1.2 * 1.2 * 0.9);
const MAX_PREWARM_SENT_KEYS = 200;
const erc20BalanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Snapshot before finalize — `settleCurrentAndCreateNewAuction` replaces `auction` with the next lot. */
function settledLotSnapshot(
  lot: AuctionSellLot | null,
): StoredWinnerHighlight | null {
  if (
    lot == null ||
    lot.tokenId <= 0n ||
    lot.amount <= 0n ||
    isAddressEqual(lot.bidder, zeroAddress)
  ) {
    return null;
  }
  return {
    fp: getWinnerFingerprint(lot.tokenId, lot.bidder, lot.amount),
    tokenId: Number(lot.tokenId),
    bidder: lot.bidder,
    amountWei: lot.amount.toString(),
  };
}

export default function GobblerAuctionSection({
  auctionBidPlacedFids,
  onBid,
  bidDisabled,
  onClaimBlockingChange,
  viewerDisplayName,
  viewerPfpUrl,
}: {
  /** FIDs where the user completed the local bid animation (demo / optimistic). */
  auctionBidPlacedFids: Set<number>;
  onBid?: (
    fid: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  bidDisabled?: boolean;
  /** When true, the home page hides buy/sell navigation and the sell section. */
  onClaimBlockingChange?: (blocking: boolean) => void;
  /** Mini App display name for the rescue thank-you line. */
  viewerDisplayName?: string | null;
  /** Mini App profile image when the viewer is the winner (API may not have Farcaster). */
  viewerPfpUrl?: string | null;
}) {
  const { address: viewerAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const live = MOCK_AUCTIONS[0];
  const [selectedQueueFid, setSelectedQueueFid] = useState<number | null>(null);
  const [bumpError, setBumpError] = useState<string | null>(null);
  const [queueBumpBladeActive, setQueueBumpBladeActive] = useState(false);
  const [queueShuffleVersion, setQueueShuffleVersion] = useState(0);
  const [mockStripOrder, setMockStripOrder] = useState<bigint[] | null>(null);
  const mockBumpStripSnapRef = useRef<bigint[] | null>(null);
  const mockBumpFidSnapRef = useRef<number | null>(null);
  const pendingMockBumpReorderRef = useRef<{
    strip: bigint[];
    fid: number;
  } | null>(null);
  const queueStripScrollRef = useRef<HTMLDivElement | null>(null);
  const queueStripInnerRef = useRef<HTMLDivElement | null>(null);
  /** When the strip is wider than the viewport, pack tiles from the left; otherwise space them around. */
  const [queueStripOverflow, setQueueStripOverflow] = useState(false);
  const [bumpVisualPhase, setBumpVisualPhase] =
    useState<QueueBumpHeadPhase>("idle");
  const [bumpAnimatingFid, setBumpAnimatingFid] = useState<number | null>(null);
  const bumpAfterBladeRef = useRef<() => void>(() => {});
  const [chainBidError, setChainBidError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [extendSuccessTick, setExtendSuccessTick] = useState(0);
  const [bidFeedbackActive, setBidFeedbackActive] = useState(false);
  const [bidLandTick, setBidLandTick] = useState(0);
  const [bidConfirmingOnChain, setBidConfirmingOnChain] = useState(false);
  /** Until land animation, don't show refetched top bid / bidder (avoids in-place tick then motion). */
  const [bidTopDisplayHold, setBidTopDisplayHold] = useState<{
    amount: string;
    bidder: Address | null;
  } | null>(null);
  const [bidHoldNoBidsUi, setBidHoldNoBidsUi] = useState(false);
  const bidLandGateRef = useRef({ sequence: false, success: false });
  const bidSubmitSnapshotRef = useRef<{
    noBids: boolean;
    amount: string;
    bidder: Address | null;
  }>({ noBids: false, amount: "", bidder: null });
  const [startError, setStartError] = useState<string | null>(null);
  const [auctionRevealTick, setAuctionRevealTick] = useState(0);
  const expectNewLotAfterSettleRef = useRef(false);
  const [dismissedWinnerFps, setDismissedWinnerFps] = useState<string[]>([]);
  const [settlementHistory, setSettlementHistory] = useState<
    SettlementRecord[]
  >([]);
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const prewarmSentKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setDismissedWinnerFps(readDismissedFpArray());
    setSettlementHistory(readSettlementHistory());
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setNowUnix(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const {
    configured: auctionSellConfigured,
    auction: chainLot,
    isAuctionLoading,
    bidDecimals,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    queueBumpFeeWei,
    queueBumpReady,
    bidTokenAddress,
    auctionPaused,
    refetchAuction,
    stremeZapAddress,
    nativeEthBidConfigured,
  } = useAuctionSellAuction();

  const { priceUsd: warpgobbSpotUsd } = useWarpgobbUsdPrice();

  const bidTokenPriceUsd = useMemo(() => {
    if (
      bidTokenAddress == null ||
      isAddressEqual(bidTokenAddress, zeroAddress)
    ) {
      return null;
    }
    if (
      bidTokenAddress.toLowerCase() !== CONTRACTS.warpgobbToken.toLowerCase()
    ) {
      return null;
    }
    return warpgobbSpotUsd;
  }, [bidTokenAddress, warpgobbSpotUsd]);

  const onChainMode = auctionSellConfigured;

  const hasParsedLot =
    auctionSellConfigured && !auctionReadError && chainLot != null;

  /** Consider a lot live only while it is not marked settled on-chain. */
  const liveAuction =
    hasParsedLot && chainLot.tokenId > 0n && !chainLot.settled;

  const idleNoChainAuction = hasParsedLot && chainLot.startTime === 0n;

  const showAuctionArtworkSkeleton =
    !idleNoChainAuction && (!onChainMode || !hasParsedLot);

  /** Must use bigint vs chain time — mock countdown must not be the only signal of expiry. */
  const auctionExpired =
    liveAuction && chainLot != null && BigInt(nowUnix) >= chainLot.endTime;

  const chainBidActive =
    liveAuction && !auctionPaused && !auctionExpired && onChainMode;

  const { data: viewerBidTokenBalance } = useReadContract({
    abi: erc20BalanceOfAbi,
    address: bidTokenAddress ?? zeroAddress,
    functionName: "balanceOf",
    args: viewerAddress != null && isConnected ? [viewerAddress] : undefined,
    query: {
      enabled:
        chainBidActive &&
        bidTokenAddress != null &&
        !isAddressEqual(bidTokenAddress, zeroAddress) &&
        viewerAddress != null &&
        isConnected,
      refetchInterval: 20_000,
    },
  });

  const { data: viewerEthBalance } = useBalance({
    address: viewerAddress,
    chainId: base.id,
    query: {
      enabled: chainBidActive && viewerAddress != null && isConnected,
      refetchInterval: 20_000,
    },
  });

  const [quoteBidWei, setQuoteBidWei] = useState<bigint | null>(null);
  const [lastGoodEthQuote, setLastGoodEthQuote] = useState<{
    minEthFormatted: string | null;
    txValueWei: bigint | null;
    txValueFormatted: string | null;
  } | null>(null);

  const {
    minBidWei,
    minBidHuman,
    placeBid,
    placeBidWithNative,
    parseHumanToWei,
    isBidding,
    rulesLoading,
  } = useAuctionSellBid({
    enabled: chainBidActive,
    lot: chainLot,
    bidTokenAddress,
    bidDecimals,
    refetchAuction,
    stremeZapAddress,
  });

  const defaultPaymentMethod = useMemo(
    () =>
      defaultAuctionBidPaymentMethod({
        nativeEthBidConfigured,
        viewerAddressDefined: Boolean(viewerAddress && isConnected),
        bidTokenBalance:
          typeof viewerBidTokenBalance === "bigint"
            ? viewerBidTokenBalance
            : undefined,
        minBidWei,
      }),
    [
      nativeEthBidConfigured,
      viewerAddress,
      isConnected,
      viewerBidTokenBalance,
      minBidWei,
    ],
  );

  useEffect(() => {
    if (minBidWei != null) {
      setQuoteBidWei((prev) =>
        prev == null || prev < minBidWei ? minBidWei : prev,
      );
    }
  }, [minBidWei]);

  const ethBidQuote = useStremeEthBidQuote({
    enabled:
      chainBidActive &&
      nativeEthBidConfigured &&
      quoteBidWei != null &&
      stremeZapAddress != null &&
      bidTokenAddress != null,
    zapAddress: stremeZapAddress,
    bidTokenAddress: bidTokenAddress ?? undefined,
    bidWei: quoteBidWei,
  });

  useEffect(() => {
    if (!ethBidQuote.data) return;
    if (ethBidQuote.data.txValueWei == null) return;
    setLastGoodEthQuote({
      minEthFormatted: ethBidQuote.data.minEthFormatted ?? null,
      txValueWei: ethBidQuote.data.txValueWei,
      txValueFormatted: ethBidQuote.data.txValueFormatted ?? null,
    });
  }, [ethBidQuote.data]);

  const queueReadsEnabled = auctionSellConfigured && !auctionReadError;
  const {
    data: chainQueuedIds = [],
    refetch: refetchQueue,
    isLoading: queueIsLoading,
  } = useAuctionSellQueue({
    enabled: queueReadsEnabled,
    excludeTokenId: liveAuction && chainLot != null ? chainLot.tokenId : undefined,
  });

  const chainQueueFingerprint = useMemo(
    () => chainQueuedIds.map((id) => id.toString()).join(","),
    [chainQueuedIds],
  );

  useEffect(() => {
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL) return;
    setMockStripOrder(null);
  }, [chainQueueFingerprint]);

  const stripQueueIds = useMemo(() => {
    let raw: bigint[];
    if (!queueReadsEnabled) raw = chainQueuedIds;
    else if (!DEV_MOCK_QUEUE_APPEND_EXTRAS) raw = chainQueuedIds;
    else if (mockStripOrder) raw = mockStripOrder;
    else raw = [...chainQueuedIds, ...DEV_MOCK_EXTRA_QUEUE_TOKEN_IDS];
    return dedupeQueueTokenIds(raw);
  }, [queueReadsEnabled, chainQueuedIds, mockStripOrder]);

  /** Skeleton tiles in the waiting row while queue is loading (not shown after load). */
  const QUEUE_STRIP_SKELETON_COUNT = 5;
  const showQueueStripSkeleton =
    !queueReadsEnabled || (queueReadsEnabled && queueIsLoading);

  const {
    settleWhenPaused,
    settleAndStartNext,
    extendAuction,
    isPending: settlePending,
    loadingStage: settleLoadingStage,
  } = useAuctionSellSettleActions({
    refetchAuction,
    refetchQueue,
  });

  const {
    startAuction,
    isPending: startAuctionPending,
    loadingStage: startAuctionLoadingStage,
  } = useAuctionSellStartAuction({
    refetchAuction,
    refetchQueue,
  });

  const { sendBumpTx, isPending: isBumping } = useAuctionQueueBump();

  useEffect(() => {
    bumpAfterBladeRef.current = () => {
      void (async () => {
        setQueueBumpBladeActive(false);
        mockBumpStripSnapRef.current = null;
        mockBumpFidSnapRef.current = null;
        await refetchQueue();
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
        setQueueShuffleVersion((v) => v + 1);
      })();
    };
  }, [refetchQueue]);

  useEffect(() => {
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL) return;
    if (bumpVisualPhase !== "fade_source") return;
    const t = window.setTimeout(() => {
      setBumpVisualPhase("head_preview");
      queueStripScrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    }, BUMP_FADE_SOURCE_MS);
    return () => clearTimeout(t);
  }, [bumpVisualPhase]);

  useEffect(() => {
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL) return;
    if (bumpVisualPhase !== "head_preview") return;
    const t = window.setTimeout(
      () => setBumpVisualPhase("finalize"),
      BUMP_HEAD_PREVIEW_MS,
    );
    return () => clearTimeout(t);
  }, [bumpVisualPhase]);

  useLayoutEffect(() => {
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL || bumpVisualPhase !== "finalize") return;
    const pending = pendingMockBumpReorderRef.current;
    if (pending == null) return;
    if (!queueReadsEnabled) {
      pendingMockBumpReorderRef.current = null;
      return;
    }
    pendingMockBumpReorderRef.current = null;
    const { strip, fid } = pending;
    const token = BigInt(fid);
    const idx = strip.findIndex((id) => id === token);
    if (idx > 0) {
      const next = [...strip];
      next.splice(idx, 1);
      next.unshift(token);
      setMockStripOrder(next);
    }
  }, [bumpVisualPhase, queueReadsEnabled]);

  useEffect(() => {
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL) return;
    if (bumpVisualPhase !== "finalize") return;
    const t = window.setTimeout(() => {
      setBumpVisualPhase("idle");
      setBumpAnimatingFid(null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setQueueShuffleVersion((v) => v + 1));
      });
    }, BUMP_FINALIZE_MS);
    return () => clearTimeout(t);
  }, [bumpVisualPhase]);

  const displayTokenId = idleNoChainAuction
    ? 0
    : hasParsedLot && chainLot.tokenId > 0n
      ? Number(chainLot.tokenId)
      : onChainMode
        ? 0
        : live.fid;

  const hasChainBid =
    liveAuction &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const prewarmTokenId = chainLot ? Number(chainLot.tokenId) : 0;
  const prewarmBidWei = chainLot ? chainLot.amount.toString() : "0";
  const prewarmTrigger =
    chainLot && chainLot.amount > 0n ? "new-bid" : "auction-start";

  useEffect(() => {
    if (!onChainMode || !liveAuction || !chainLot) return;
    const tokenId = prewarmTokenId;
    if (!Number.isInteger(tokenId) || tokenId <= 0) return;

    // Trigger once on auction start, then once per new top bid amount.
    const bidWei = prewarmBidWei;
    const key = `${tokenId}:${bidWei}`;
    if (prewarmSentKeysRef.current.has(key)) return;
    if (prewarmSentKeysRef.current.size >= MAX_PREWARM_SENT_KEYS) {
      prewarmSentKeysRef.current.clear();
    }
    prewarmSentKeysRef.current.add(key);

    const trigger = prewarmTrigger;
    void fetch("/api/gobbled-prewarm-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenId, trigger, bidWei }),
    })
      .then(async (res) => {
        if (res.ok) return;
        const text = await res.text();
        console.warn("[gobbled-prewarm] request failed", {
          tokenId,
          trigger,
          status: res.status,
          body: text,
        });
      })
      .catch((error) => {
        console.warn("[gobbled-prewarm] request threw", {
          tokenId,
          trigger,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [
    onChainMode,
    liveAuction,
    chainLot,
    prewarmTokenId,
    prewarmBidWei,
    prewarmTrigger,
  ]);

  const auctionSettled = hasParsedLot && chainLot.settled;

  const topBidAmountStr = idleNoChainAuction
    ? "—"
    : liveAuction
      ? hasChainBid
        ? formatBidAmount(chainLot.amount)
        : "0"
      : auctionSettled && hasParsedLot && chainLot
        ? formatBidAmount(chainLot.amount)
        : onChainMode
          ? "—"
          : MOCK_FALLBACK_TOP_BID_AMOUNT;

  const chainTopBidder: Address | null = liveAuction
    ? hasChainBid
      ? chainLot.bidder
      : null
    : auctionSettled && chainLot != null && chainLot.amount > 0n
      ? chainLot.bidder
      : onChainMode
        ? null
        : (MOCK_FALLBACK_TOP_BIDDER as Address);

  const showNoBids = !idleNoChainAuction && liveAuction && !hasChainBid;

  const hasLastSettledWinner =
    hasParsedLot &&
    auctionSettled &&
    chainLot.tokenId > 0n &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const chainSettledWinnerSnap = useMemo((): StoredWinnerHighlight | null => {
    if (!hasLastSettledWinner || !chainLot) return null;
    return {
      fp: getWinnerFingerprint(
        chainLot.tokenId,
        chainLot.bidder,
        chainLot.amount,
      ),
      tokenId: Number(chainLot.tokenId),
      bidder: chainLot.bidder,
      amountWei: chainLot.amount.toString(),
    };
  }, [hasLastSettledWinner, chainLot]);

  /** On-chain settled row gets `endTime` for ordering when not yet in local history. */
  const chainSettlementRecord = useMemo((): SettlementRecord | null => {
    if (!onChainMode || !chainSettledWinnerSnap || !chainLot) return null;
    const recordedAt =
      chainLot.endTime > 0n ? Number(chainLot.endTime) * 1000 : Date.now();
    return { ...chainSettledWinnerSnap, recordedAt };
  }, [onChainMode, chainSettledWinnerSnap, chainLot]);

  const mergedSettlementRecords = useMemo((): SettlementRecord[] => {
    const byFp = new Map<string, SettlementRecord>();
    for (const r of settlementHistory) {
      byFp.set(r.fp, r);
    }
    if (chainSettlementRecord) {
      const prev = byFp.get(chainSettlementRecord.fp);
      byFp.set(chainSettlementRecord.fp, {
        ...chainSettlementRecord,
        recordedAt: prev
          ? Math.max(prev.recordedAt, chainSettlementRecord.recordedAt)
          : chainSettlementRecord.recordedAt,
      });
    }
    return [...byFp.values()];
  }, [settlementHistory, chainSettlementRecord]);

  const dismissedFpSet = useMemo(
    () => new Set(dismissedWinnerFps),
    [dismissedWinnerFps],
  );

  const sortedOpenSettlements = useMemo(() => {
    if (!onChainMode) return [];
    const open = mergedSettlementRecords.filter(
      (r) => !dismissedFpSet.has(r.fp),
    );
    return sortSettlementsForDisplay(open);
  }, [onChainMode, mergedSettlementRecords, dismissedFpSet]);

  /** Which won lot the connected wallet should rescue first (chain-won ties over history). */
  const claimFocusRecord = useMemo((): SettlementRecord | null => {
    if (!viewerAddress || sortedOpenSettlements.length === 0) return null;
    const wins = sortedOpenSettlements.filter((r) =>
      isAddressEqual(viewerAddress, r.bidder),
    );
    if (wins.length === 0) return null;
    if (
      chainSettlementRecord &&
      wins.some((w) => w.fp === chainSettlementRecord.fp)
    ) {
      return wins.find((w) => w.fp === chainSettlementRecord.fp)!;
    }
    return wins.reduce((best, r) => {
      const br = BigInt(best.amountWei);
      const ar = BigInt(r.amountWei);
      if (ar > br) return r;
      if (ar < br) return best;
      return r.recordedAt > best.recordedAt ? r : best;
    });
  }, [viewerAddress, sortedOpenSettlements, chainSettlementRecord]);

  const displaySettlementRows = useMemo(
    () =>
      pickDisplaySettlementRows(
        sortedOpenSettlements,
        claimFocusRecord,
        SETTLEMENT_DISPLAY_LIMIT,
      ),
    [sortedOpenSettlements, claimFocusRecord],
  );

  const showLastWinnerBanner = displaySettlementRows.length > 0;

  const onQueueEmptyBetweenSales =
    queueReadsEnabled &&
    chainQueuedIds.length === 0 &&
    !liveAuction &&
    onChainMode;

  const auctionHydrating =
    onChainMode && !auctionReadError && chainLot == null && isAuctionLoading;

  /**
   * No live auction — show start/restart controls for idle slot, after settlement,
   * or while the auction struct is still syncing (so the buy section is never action-less).
   * Queue may be empty: button stays visible (disabled) with an explanation.
   */
  const showStartAuctionControls =
    onChainMode &&
    !auctionReadError &&
    !liveAuction &&
    (auctionSettled || idleNoChainAuction || auctionHydrating);

  const startAuctionQueueEmpty =
    showStartAuctionControls &&
    queueReadsEnabled &&
    !queueIsLoading &&
    chainQueuedIds.length === 0 &&
    !auctionHydrating;

  const startAuctionQueueLoading =
    showStartAuctionControls && queueReadsEnabled && queueIsLoading;

  const startAuctionBlockedByHydration =
    showStartAuctionControls && auctionHydrating;

  const handleDismissSettlement = useCallback((fp: string) => {
    setDismissedWinnerFps(addDismissedFp(fp));
  }, []);

  // ---------- Gobbled-warplet rescue (signed mint + NFT pull) ----------
  const rescue = useGobbledRescue();

  // Reset the rescue hook whenever we move to a different winner / lot, otherwise stale
  // success/error state from a previous lot would leak into the new banner.
  const lastClaimedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!claimFocusRecord) return;
    if (lastClaimedFpRef.current !== claimFocusRecord.fp) {
      lastClaimedFpRef.current = claimFocusRecord.fp;
      rescue.reset();
    }
  }, [claimFocusRecord, rescue]);

  // After a successful rescue, dismiss that row so we don't keep showing the CTA.
  useEffect(() => {
    if (rescue.stage !== "success") return;
    const fp = claimFocusRecord?.fp;
    if (fp == null) return;
    const t = setTimeout(() => {
      setDismissedWinnerFps(addDismissedFp(fp));
    }, 1500);
    return () => clearTimeout(t);
  }, [rescue.stage, claimFocusRecord?.fp]);

  const handleClaimWarplet = useCallback(() => {
    if (!claimFocusRecord) return;
    void rescue.claim(claimFocusRecord.tokenId);
  }, [rescue, claimFocusRecord]);

  const claimAction: ClaimAction | undefined =
    claimFocusRecord &&
    viewerAddress &&
    isAddressEqual(viewerAddress, claimFocusRecord.bidder) &&
    rescue.ready
      ? {
          visible: true,
          stage: rescue.stage,
          error: rescue.error,
          onClaim: handleClaimWarplet,
        }
      : undefined;

  const claimBlocking = Boolean(
    claimFocusRecord &&
    viewerAddress &&
    isAddressEqual(viewerAddress, claimFocusRecord.bidder) &&
    rescue.ready &&
    rescue.stage !== "success",
  );

  const claimForRow = useCallback(
    (row: SettlementRecord): ClaimAction | undefined => {
      if (
        !claimFocusRecord ||
        row.fp !== claimFocusRecord.fp ||
        !viewerAddress ||
        !isAddressEqual(viewerAddress, row.bidder) ||
        !rescue.ready
      ) {
        return undefined;
      }
      return {
        visible: true,
        stage: rescue.stage,
        error: rescue.error,
        onClaim: () => void rescue.claim(row.tokenId),
      };
    },
    [claimFocusRecord, viewerAddress, rescue],
  );

  useLayoutEffect(() => {
    onClaimBlockingChange?.(claimBlocking);
    return () => {
      if (claimBlocking) onClaimBlockingChange?.(false);
    };
  }, [claimBlocking, onClaimBlockingChange]);

  const handleStartNewAuction = useCallback(async () => {
    setStartError(null);
    const head = chainQueuedIds[0];
    if (head == null) {
      setStartError("Queue is empty.");
      return;
    }
    try {
      await startAuction(head);
    } catch (e) {
      setStartError(formatUserFacingTxError(e));
    }
  }, [chainQueuedIds, startAuction]);

  const chainCountdownLive = liveAuction && !idleNoChainAuction;
  const countdownEndUnix = chainCountdownLive
    ? Number(chainLot!.endTime)
    : undefined;
  /** Only demo mode uses a relative timer — never fake “time’s up” when an AuctionSell address is configured. */
  const countdownDurationSecs =
    !onChainMode && !chainCountdownLive ? live.endsSecs : undefined;

  const userCompletedLocalBid = auctionBidPlacedFids.has(displayTokenId);

  /** After the demo bid animation (mock), show the viewer when connected; on-chain use lot bidder. */
  const displayTopBidder: Address | null = idleNoChainAuction
    ? null
    : !liveAuction && userCompletedLocalBid && viewerAddress != null
      ? viewerAddress
      : chainTopBidder;

  const queuedRows = useMemo(
    () =>
      queueReadsEnabled
        ? stripQueueIds.map((id, i) => ({
            fid: Number(id),
            place: i + 2,
          }))
        : [],
    [queueReadsEnabled, stripQueueIds],
  );

  /** Same render as `queuedRows` updates — avoids one frame with a stale selection after the queue drops a fid. */
  const selectedInQueueFid = useMemo(() => {
    if (selectedQueueFid == null) return null;
    return queuedRows.some((r) => r.fid === selectedQueueFid)
      ? selectedQueueFid
      : null;
  }, [selectedQueueFid, queuedRows]);

  /** Index in the *visible* queue strip (mock or on-chain) — must not use `chainQueuedIds` alone or mocks always get -1. */
  const selectedQueueIdx = useMemo(() => {
    if (selectedInQueueFid == null) return -1;
    return queuedRows.findIndex((r) => r.fid === selectedInQueueFid);
  }, [selectedInQueueFid, queuedRows]);

  const prevBigint =
    queueReadsEnabled && selectedQueueIdx > 0
      ? stripQueueIds[selectedQueueIdx - 1]!
      : null;

  const alreadyFirst = selectedQueueIdx === 0;

  const bumpLiveReady =
    queueReadsEnabled &&
    selectedQueueIdx > 0 &&
    !DEV_MOCK_QUEUE_SKIP_CTA_DISABLED &&
    (DEV_MOCK_QUEUE_BUMP_LOCAL || queueBumpReady);

  useEffect(() => {
    if (selectedQueueFid == null) return;
    if (!queuedRows.some((r) => r.fid === selectedQueueFid)) {
      setSelectedQueueFid(null);
    }
  }, [queuedRows, selectedQueueFid, setSelectedQueueFid]);

  useLayoutEffect(() => {
    const root = queueStripScrollRef.current;
    const inner = queueStripInnerRef.current;
    if (!root) return;
    const measure = () => {
      const cw = root.clientWidth;
      setQueueStripOverflow(cw > 0 && root.scrollWidth > cw + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [queuedRows.length, showQueueStripSkeleton, queueShuffleVersion]);

  const handleQueueBump = useCallback(async () => {
    setBumpError(null);
    if (DEV_MOCK_QUEUE_SKIP_CTA_DISABLED) return;
    if (DEV_MOCK_QUEUE_BUMP_LOCAL && queueReadsEnabled) {
      if (selectedInQueueFid == null || selectedQueueIdx <= 0) return;
      if (bumpVisualPhase !== "idle") return;
      pendingMockBumpReorderRef.current = {
        strip: [...stripQueueIds],
        fid: selectedInQueueFid,
      };
      setBumpAnimatingFid(selectedInQueueFid);
      setBumpVisualPhase("fade_source");
      return;
    }
    if (
      !queueBumpReady ||
      !bidTokenAddress ||
      queueBumpFeeWei == null ||
      selectedInQueueFid == null ||
      prevBigint == null
    )
      return;
    try {
      const hash = await sendBumpTx({
        bidTokenAddress,
        auctionSellAddress: CONTRACTS.auctionSell,
        amount: queueBumpFeeWei,
        tokenId: BigInt(selectedInQueueFid),
        prev: prevBigint,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setQueueBumpBladeActive(true);
    } catch (e) {
      setBumpError(formatUserFacingTxError(e));
    }
  }, [
    bidTokenAddress,
    prevBigint,
    publicClient,
    queueBumpFeeWei,
    queueBumpReady,
    queueReadsEnabled,
    selectedInQueueFid,
    selectedQueueIdx,
    sendBumpTx,
    stripQueueIds,
    bumpVisualPhase,
  ]);

  const skipLineOptionVisible = queuedRows.length >= 2;

  useEffect(() => {
    if (!skipLineOptionVisible) {
      setSelectedQueueFid(null);
    }
  }, [skipLineOptionVisible]);

  /** Bump pay row mirrors sell CTA: show whenever multiple queue slots exist (outlined until a tile is picked). */
  const showBumpPanel = skipLineOptionVisible;

  const clearBidTopDisplayHold = useCallback(() => {
    setBidTopDisplayHold(null);
    setBidHoldNoBidsUi(false);
  }, []);

  const maybeBumpBidLandTick = useCallback(() => {
    const g = bidLandGateRef.current;
    if (g.sequence && g.success) {
      bidLandGateRef.current = { sequence: false, success: false };
      clearBidTopDisplayHold();
      setBidLandTick((t) => t + 1);
    }
  }, [clearBidTopDisplayHold]);

  const onBidFeedbackSequenceComplete = useCallback(() => {
    setBidFeedbackActive(false);
    bidLandGateRef.current.sequence = true;
    maybeBumpBidLandTick();
  }, [maybeBumpBidLandTick]);

  const handleChainBidSubmit = useCallback(
    async (
      amountWei: bigint,
      opts?: { payment: "eth"; txValueWei: bigint } | { payment?: "token" },
    ) => {
      setChainBidError(null);
      bidLandGateRef.current = { sequence: false, success: false };
      bidSubmitSnapshotRef.current = {
        noBids: showNoBids,
        amount: topBidAmountStr,
        bidder: chainTopBidder,
      };
      const onTxSubmitted = () => {
        setBidConfirmingOnChain(true);
        setBidFeedbackActive(true);
        window.dispatchEvent(new CustomEvent("gobbler:bid-placed"));
        const s = bidSubmitSnapshotRef.current;
        if (s.noBids) setBidHoldNoBidsUi(true);
        else setBidTopDisplayHold({ amount: s.amount, bidder: s.bidder });
      };
      try {
        const payWithEth = opts?.payment === "eth";
        if (payWithEth) {
          if (!opts || opts.payment !== "eth" || opts.txValueWei <= 0n) {
            throw new Error("ETH quote unavailable.");
          }
          await placeBidWithNative(amountWei, opts.txValueWei, {
            onTransactionSubmitted: onTxSubmitted,
          });
        } else {
          await placeBid(amountWei, {
            onTransactionSubmitted: onTxSubmitted,
          });
        }
        bidLandGateRef.current.success = true;
        maybeBumpBidLandTick();
      } catch (e) {
        setBidFeedbackActive(false);
        bidLandGateRef.current = { sequence: false, success: false };
        clearBidTopDisplayHold();
        setChainBidError(formatUserFacingTxError(e));
      } finally {
        setBidConfirmingOnChain(false);
      }
    },
    [
      placeBid,
      placeBidWithNative,
      maybeBumpBidLandTick,
      clearBidTopDisplayHold,
      showNoBids,
      topBidAmountStr,
      chainTopBidder,
    ],
  );

  const viewerBidTokenBalanceHuman =
    typeof viewerBidTokenBalance !== "bigint"
      ? null
      : Number(formatUnits(viewerBidTokenBalance, bidDecimals)).toLocaleString(
          undefined,
          { maximumFractionDigits: 0 },
        );

  const viewerEthBalanceHuman =
    viewerEthBalance == null
      ? null
      : Number(viewerEthBalance.formatted).toLocaleString(undefined, {
          maximumFractionDigits: 6,
        });

  const ethBidQuoteError =
    ethBidQuote.isError && ethBidQuote.error ? ethBidQuote.error.message : null;

  const handleSettlePaused = useCallback(async () => {
    setSettleError(null);
    expectNewLotAfterSettleRef.current = false;
    const snap = settledLotSnapshot(chainLot);
    try {
      await settleWhenPaused();
      if (snap) {
        const next = appendSettlementRecord({
          ...snap,
          recordedAt: Date.now(),
        });
        setSettlementHistory(next);
      }
    } catch (e) {
      setSettleError(formatUserFacingTxError(e));
    }
  }, [settleWhenPaused, chainLot]);

  const handleSettleAndNext = useCallback(async () => {
    setSettleError(null);
    const snap = settledLotSnapshot(chainLot);
    expectNewLotAfterSettleRef.current = true;
    try {
      await settleAndStartNext();
      if (snap) {
        const next = appendSettlementRecord({
          ...snap,
          recordedAt: Date.now(),
        });
        setSettlementHistory(next);
      }
    } catch (e) {
      expectNewLotAfterSettleRef.current = false;
      setSettleError(formatUserFacingTxError(e));
    }
  }, [settleAndStartNext, chainLot]);

  const handleExtendAuction = useCallback(async () => {
    setSettleError(null);
    expectNewLotAfterSettleRef.current = false;
    try {
      await extendAuction();
      setExtendSuccessTick((n) => n + 1);
    } catch (e) {
      setSettleError(formatUserFacingTxError(e));
    }
  }, [extendAuction]);

  useEffect(() => {
    if (!expectNewLotAfterSettleRef.current || settlePending) return;
    expectNewLotAfterSettleRef.current = false;
    if (liveAuction && !auctionSettled) {
      setAuctionRevealTick((t) => t + 1);
    }
  }, [settlePending, liveAuction, auctionSettled]);

  const showExpiredPostAuction =
    onChainMode &&
    hasParsedLot &&
    liveAuction &&
    auctionExpired &&
    !auctionSettled;

  const postAuctionNoActionHint =
    showExpiredPostAuction && !hasChainBid && auctionPaused
      ? "No bids — house paused. Unpause, then extend."
      : null;

  /** Do not fold in `bidDisabled` — the page uses that to gate *bidding* (e.g. when expired), which would wrongly grey out extend / finalize. */
  const settlementDisabled = !isConnected || !!auctionReadError;

  /** Do not use `bidDisabled` — after settlement `minNextBidAmount` is null, which incorrectly marked bidding UI disabled. */
  const startNewDisabled = !isConnected || !!auctionReadError || auctionPaused;
  const hasNextQueuedWarplet = queueReadsEnabled && chainQueuedIds.length > 0;

  const chainSettlement =
    showExpiredPostAuction && hasChainBid && auctionPaused
      ? {
          label: "Settle auction",
          hint: "Completes this sale on-chain while the house is paused.",
          onSubmit: handleSettlePaused,
          loading: settlePending,
          disabled: settlementDisabled,
          error: settleError,
          onClearError: () => setSettleError(null),
        }
      : showExpiredPostAuction && hasChainBid && !auctionPaused
        ? {
            label: hasNextQueuedWarplet
              ? "Start next auction"
              : "Settle auction",
            hint: null,
            onSubmit: handleSettleAndNext,
            loading: settlePending,
            disabled: settlementDisabled,
            error: settleError,
            onClearError: () => setSettleError(null),
          }
        : showExpiredPostAuction && !hasChainBid && !auctionPaused
          ? {
              label: "Start Next Auction",
              hint: "",
              onSubmit: handleExtendAuction,
              loading: settlePending,
              disabled: settlementDisabled,
              error: settleError,
              onClearError: () => setSettleError(null),
            }
          : null;

  const bidInviteCopy = null;

  const onChainLiveQueueEmpty =
    queueReadsEnabled && liveAuction && chainQueuedIds.length === 0;

  const settledFooterCopy =
    !auctionSettled || startAuctionQueueEmpty
      ? null
      : "Auction ended. Start the next auction.";

  if (claimBlocking && claimFocusRecord && claimAction != null) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center justify-start pb-4 sm:pb-6">
        <AuctionWinnerClaimGate
          tokenId={claimFocusRecord.tokenId}
          winnerAddress={claimFocusRecord.bidder}
          winAmountLabel={formatBidAmount(BigInt(claimFocusRecord.amountWei))}
          bidSymbol={bidSymbol}
          viewerAddress={viewerAddress}
          viewerDisplayName={viewerDisplayName}
          viewerPfpUrl={viewerPfpUrl}
          claim={claimAction}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <BidFeedbackOverlay
        active={bidFeedbackActive}
        onSequenceComplete={onBidFeedbackSequenceComplete}
      />

      <AuctionLiveHero
        displayTokenId={displayTokenId}
        artworkSkeleton={showAuctionArtworkSkeleton}
        topBidAmountStr={bidTopDisplayHold?.amount ?? topBidAmountStr}
        bidSymbol={bidSymbol}
        topBidder={
          bidTopDisplayHold != null
            ? bidTopDisplayHold.bidder
            : displayTopBidder
        }
        viewerAddress={viewerAddress}
        showNoBids={showNoBids || bidHoldNoBidsUi}
        countdownEndUnix={countdownEndUnix}
        countdownDurationSecs={countdownDurationSecs}
        auctionSettled={auctionSettled}
        settledFooterCopy={settledFooterCopy}
        startNewAuction={
          showStartAuctionControls
            ? {
                onStart: () => void handleStartNewAuction(),
                disabled:
                  startNewDisabled ||
                  startAuctionPending ||
                  startAuctionQueueEmpty ||
                  startAuctionQueueLoading ||
                  startAuctionBlockedByHydration,
                loading: startAuctionPending,
                loadingStage: startAuctionLoadingStage,
                error: startError,
                housePaused: auctionPaused,
                queueBlockedReason: startAuctionBlockedByHydration
                  ? "Syncing the latest auction state…"
                  : startAuctionQueueLoading
                    ? "Loading the queue…"
                    : startAuctionQueueEmpty
                      ? "Queue empty — sell a Warplet to the Gobbler."
                      : null,
              }
            : null
        }
        bidDisabled={bidDisabled}
        onBid={chainBidActive ? undefined : onBid}
        chainBid={
          chainBidActive
            ? {
                minBidHuman,
                minBidWei,
                bidDecimals,
                parseHumanToWei,
                onSubmit: handleChainBidSubmit,
                loading: isBidding || rulesLoading || bidConfirmingOnChain,
                disabled: bidDisabled || rulesLoading || minBidWei == null,
                error: chainBidError,
                onClearTxError: () => setChainBidError(null),
                bidTokenPriceUsd,
                defaultPaymentMethod,
                onBidWeiDebounced: setQuoteBidWei,
                viewerBidTokenBalanceHuman,
                viewerEthBalanceHuman,
                nativeEthBid: nativeEthBidConfigured
                  ? {
                      available: true,
                      quoteLoading:
                        ethBidQuote.isFetching &&
                        ethBidQuote.data?.txValueWei == null &&
                        lastGoodEthQuote?.txValueWei == null,
                      quoteError:
                        ethBidQuoteError && lastGoodEthQuote?.txValueWei == null
                          ? ethBidQuoteError
                          : null,
                      minEthFormatted:
                        ethBidQuote.data?.minEthFormatted ??
                        lastGoodEthQuote?.minEthFormatted ??
                        null,
                      txValueWei:
                        ethBidQuote.data?.txValueWei ??
                        lastGoodEthQuote?.txValueWei ??
                        null,
                      txValueFormatted:
                        ethBidQuote.data?.txValueFormatted ??
                        lastGoodEthQuote?.txValueFormatted ??
                        null,
                      onRefreshQuote: () => void ethBidQuote.refetch(),
                    }
                  : undefined,
              }
            : undefined
        }
        idleNoChainAuction={idleNoChainAuction}
        auctionExpiredOnChain={auctionExpired}
        contractPaused={auctionPaused}
        chainSettlement={chainSettlement}
        postAuctionNoActionHint={postAuctionNoActionHint}
        bidInviteCopy={bidInviteCopy}
        extendSuccessTick={extendSuccessTick}
        bidLandTick={bidLandTick}
        auctionRevealTick={auctionRevealTick}
        settlementTransition={
          settlePending
            ? { active: true, stage: settleLoadingStage }
            : { active: false, stage: null }
        }
        countdownResetKey={
          chainCountdownLive && chainLot != null
            ? chainLot.endTime.toString()
            : undefined
        }
      />

      {onQueueEmptyBetweenSales && showLastWinnerBanner && !claimBlocking ? (
        <div className="mt-3 w-full flex justify-center px-1">
          <LastAuctionSettlementStack
            rows={displaySettlementRows}
            bidSymbol={bidSymbol}
            formatBidAmount={formatBidAmount}
            viewerAddress={viewerAddress}
            viewerDisplayName={viewerDisplayName}
            viewerPfpUrl={viewerPfpUrl}
            onDismissRow={handleDismissSettlement}
            claimForRow={claimForRow}
          />
        </div>
      ) : null}

      {onQueueEmptyBetweenSales ? null : (
        <>
          <h3 className="text-sm sm:text-base font-semibold tracking-wide text-base-content/50 mb-1 px-2 text-center">
            Up next
          </h3>
          {queueReadsEnabled && onChainLiveQueueEmpty ? (
            <p className="text-xs text-base-content/40 mb-2 max-w-xl mx-auto px-2 text-center">
              No Warplets currently queued. The Gobbler is hungry.
            </p>
          ) : null}
          <div className="w-full flex flex-col items-center">
            <div className="w-full pb-2 pt-1 px-1">
              {/*
                One scroll row: [On Deck][#2][#3]…
                - The first queued Warplet owns the left-most visible slot.
                - Short queue: whole row is mx-auto (cluster sits in the middle, gap-2 next to #2).
                - Long queue: row hugs the left; horizontal scroll keeps the active bump preview sticky.
              */}
              <div className="relative w-full min-h-[7rem] sm:min-h-[9rem]">
                <QueueBumpCutStrip
                  active={queueBumpBladeActive}
                  onSequenceComplete={() => bumpAfterBladeRef.current()}
                />
                <div
                  ref={queueStripScrollRef}
                  className="relative z-10 w-full min-w-0 overflow-x-auto overflow-y-visible scrollbar-hide snap-x snap-mandatory"
                >
                  <div
                    ref={queueStripInnerRef}
                    className={`flex w-max min-h-[7rem] items-start gap-2 sm:min-h-[9rem] sm:gap-2 ${
                      queueStripOverflow ? "" : "mx-auto"
                    }`}
                  >
                    {!showQueueStripSkeleton &&
                    (bumpVisualPhase !== "idle" || bumpAnimatingFid != null) ? (
                      <div className="sticky left-0 z-20 shrink-0 self-start isolate">
                        <div className="rounded-xl bg-base-100/95 shadow-[8px_0_20px_-6px_rgba(19,17,28,0.85)] ring-1 ring-base-content/[0.08] backdrop-blur-sm supports-[backdrop-filter]:bg-base-100/80">
                          <QueueStripCellChrome
                            shuffleVersion={queueShuffleVersion}
                            slotIndex={0}
                            className="shrink-0"
                          >
                            <AuctionQueueHeadSlot
                              bumpPhase={bumpVisualPhase}
                              selectionPreviewFid={null}
                              bumpPreviewFid={bumpAnimatingFid}
                            />
                          </QueueStripCellChrome>
                        </div>
                      </div>
                    ) : null}
                    {showQueueStripSkeleton
                      ? Array.from(
                          { length: QUEUE_STRIP_SKELETON_COUNT },
                          (_, i) => (
                            <QueueStripCellChrome
                              key={`queue-sk-${i}`}
                              shuffleVersion={0}
                              slotIndex={i + 1}
                              className="shrink-0 snap-center"
                            >
                              <AuctionQueueCardSkeleton />
                            </QueueStripCellChrome>
                          ),
                        )
                      : queuedRows.map((row, i) => (
                          <QueueStripCellChrome
                            key={row.fid}
                            shuffleVersion={queueShuffleVersion}
                            slotIndex={i + 1}
                            className="shrink-0 snap-center"
                          >
                            <AuctionQueueCard
                              fid={row.fid}
                              placeInLine={row.place}
                              isSelected={selectedInQueueFid === row.fid}
                              sourceBumpFadeOut={
                                DEV_MOCK_QUEUE_BUMP_LOCAL &&
                                bumpVisualPhase === "fade_source" &&
                                bumpAnimatingFid === row.fid
                              }
                              sourceBumpEmptyHold={
                                DEV_MOCK_QUEUE_BUMP_LOCAL &&
                                bumpVisualPhase === "head_preview" &&
                                bumpAnimatingFid === row.fid
                              }
                              bumpStripLand={
                                DEV_MOCK_QUEUE_BUMP_LOCAL &&
                                bumpVisualPhase === "finalize" &&
                                bumpAnimatingFid === row.fid &&
                                i === 0
                              }
                              onSelect={() =>
                                setSelectedQueueFid(
                                  selectedQueueFid === row.fid ? null : row.fid,
                                )
                              }
                            />
                          </QueueStripCellChrome>
                        ))}
                  </div>
                </div>
              </div>
            </div>

            {showBumpPanel && (
              <div className="mt-3 sm:mt-4 w-full flex justify-center">
                <AuctionQueueBumpPanel
                  bidSymbol={bidSymbol}
                  hasQueueSelection={selectedInQueueFid != null}
                  alreadyFirst={alreadyFirst}
                  bumpLiveReady={bumpLiveReady}
                  bumpDisabled={
                    (!isConnected && !DEV_MOCK_QUEUE_BUMP_LOCAL) ||
                    DEV_MOCK_QUEUE_SKIP_CTA_DISABLED ||
                    bumpVisualPhase !== "idle"
                  }
                  bumpHint={bumpError}
                  onBump={handleQueueBump}
                  isBumping={isBumping}
                />
              </div>
            )}
            {showLastWinnerBanner && !claimBlocking ? (
              <div className="mt-4 w-full flex justify-center px-1">
                <LastAuctionSettlementStack
                  rows={displaySettlementRows}
                  bidSymbol={bidSymbol}
                  formatBidAmount={formatBidAmount}
                  viewerAddress={viewerAddress}
                  viewerDisplayName={viewerDisplayName}
                  viewerPfpUrl={viewerPfpUrl}
                  onDismissRow={handleDismissSettlement}
                  claimForRow={claimForRow}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
