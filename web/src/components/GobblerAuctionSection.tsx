"use client";

import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount, usePublicClient } from "wagmi";
import AuctionLiveHero from "./AuctionLiveHero";
import LastAuctionWinnerBanner, {
  clearWinnerHighlight,
  getWinnerFingerprint,
  readDismissedWinnerFp,
  readWinnerHighlight,
  writeDismissedWinnerFp,
  writeWinnerHighlight,
  type ClaimAction,
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
import { useAuctionSellSettleActions } from "@/hooks/useAuctionSellSettle";
import { useAuctionSellStartAuction } from "@/hooks/useAuctionSellStartAuction";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { useAuctionQueueBump } from "@/hooks/useAuctionQueueBump";
import { useGobbledRescue } from "@/hooks/useGobbledRescue";
import { useWarpgobbUsdPrice } from "@/hooks/useDutchAuction";
import { CONTRACTS } from "@/lib/contracts";
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

function readInitialWinnerHighlight(): StoredWinnerHighlight | null {
  if (typeof window === "undefined") return null;
  const dismissed = readDismissedWinnerFp();
  const h = readWinnerHighlight();
  if (h == null) return null;
  if (dismissed != null && h.fp === dismissed) {
    clearWinnerHighlight();
    return null;
  }
  return h;
}

/** Snapshot before finalize — `settleCurrentAndCreateNewAuction` replaces `auction` with the next lot. */
function settledLotSnapshot(lot: AuctionSellLot | null): StoredWinnerHighlight | null {
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
}: {
  /** FIDs where the user completed the local bid animation (demo / optimistic). */
  auctionBidPlacedFids: Set<number>;
  onBid?: (
    fid: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  bidDisabled?: boolean;
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
  const [dismissedWinnerFp, setDismissedWinnerFp] = useState<string | null>(
    () => (typeof window !== "undefined" ? readDismissedWinnerFp() : null),
  );
  const [winnerHighlight, setWinnerHighlight] = useState<
    StoredWinnerHighlight | null
  >(readInitialWinnerHighlight);
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));

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
    bidDecimals,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    queueBumpFeeWei,
    queueBumpReady,
    bidTokenAddress,
    auctionPaused,
    refetchAuction,
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
    auctionSellConfigured &&
    !auctionReadError &&
    chainLot != null;

  const liveAuction =
    hasParsedLot &&
    chainLot.tokenId > 0n &&
    !chainLot.settled;

  const idleNoChainAuction =
    hasParsedLot &&
    chainLot.startTime === 0n &&
    !chainLot.settled;

  const showAuctionArtworkSkeleton =
    !idleNoChainAuction && (!onChainMode || !hasParsedLot);

  /** Must use bigint vs chain time — mock countdown must not be the only signal of expiry. */
  const auctionExpired =
    liveAuction &&
    chainLot != null &&
    BigInt(nowUnix) >= chainLot.endTime;

  const chainBidActive =
    liveAuction && !auctionPaused && !auctionExpired && onChainMode;

  const {
    minBidWei,
    minBidHuman,
    placeBid,
    parseHumanToWei,
    isBidding,
    rulesLoading,
  } = useAuctionSellBid({
    enabled: chainBidActive,
    lot: chainLot,
    bidTokenAddress,
    bidDecimals,
    refetchAuction,
  });

  const queueReadsEnabled = auctionSellConfigured && !auctionReadError;
  const {
    data: chainQueuedIds = [],
    refetch: refetchQueue,
    isLoading: queueIsLoading,
  } = useAuctionSellQueue({
    enabled: queueReadsEnabled,
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
    if (!DEV_MOCK_QUEUE_BUMP_LOCAL || bumpVisualPhase !== "finalize")
      return;
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

  const displayTokenId =
    idleNoChainAuction
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
    : auctionSettled && chainLot.amount > 0n
      ? chainLot.bidder
      : onChainMode
        ? null
        : (MOCK_FALLBACK_TOP_BIDDER as Address);

  const showNoBids =
    !idleNoChainAuction && liveAuction && !hasChainBid;

  const hasLastSettledWinner =
    hasParsedLot &&
    auctionSettled &&
    chainLot.tokenId > 0n &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const chainWinnerBanner = useMemo((): StoredWinnerHighlight | null => {
    if (!hasLastSettledWinner || !chainLot) return null;
    return {
      fp: getWinnerFingerprint(chainLot.tokenId, chainLot.bidder, chainLot.amount),
      tokenId: Number(chainLot.tokenId),
      bidder: chainLot.bidder,
      amountWei: chainLot.amount.toString(),
    };
  }, [hasLastSettledWinner, chainLot]);

  /** Prefer on-chain settled lot; else last finalize snapshot (next lot may already be live). */
  const winnerBannerDisplay = useMemo((): StoredWinnerHighlight | null => {
    if (!onChainMode) return null;
    if (chainWinnerBanner && chainWinnerBanner.fp !== dismissedWinnerFp) {
      return chainWinnerBanner;
    }
    if (winnerHighlight && winnerHighlight.fp !== dismissedWinnerFp) {
      return winnerHighlight;
    }
    return null;
  }, [onChainMode, chainWinnerBanner, winnerHighlight, dismissedWinnerFp]);

  const showLastWinnerBanner = Boolean(winnerBannerDisplay);

  const onQueueEmptyBetweenSales =
    queueReadsEnabled &&
    chainQueuedIds.length === 0 &&
    !liveAuction &&
    onChainMode;

  /** Queue has a next lot but there is no live auction — anyone can call `startAuction` (when unpaused). */
  const showStartNewAuctionCta =
    onChainMode &&
    !auctionReadError &&
    !liveAuction &&
    chainQueuedIds.length > 0 &&
    (auctionSettled || idleNoChainAuction);

  const handleDismissWinnerBanner = useCallback(() => {
    const fp = winnerBannerDisplay?.fp;
    if (fp == null) return;
    writeDismissedWinnerFp(fp);
    setDismissedWinnerFp(fp);
    clearWinnerHighlight();
    setWinnerHighlight(null);
  }, [winnerBannerDisplay?.fp]);

  // ---------- Gobbled-warplet rescue (signed mint + NFT pull) ----------
  const rescue = useGobbledRescue();

  const viewerIsWinner = useMemo(() => {
    if (!winnerBannerDisplay || viewerAddress == null) return false;
    return isAddressEqual(viewerAddress, winnerBannerDisplay.bidder);
  }, [winnerBannerDisplay, viewerAddress]);

  // Reset the rescue hook whenever we move to a different winner / lot, otherwise stale
  // success/error state from a previous lot would leak into the new banner.
  const lastClaimedFpRef = useRef<string | null>(null);
  useEffect(() => {
    if (!winnerBannerDisplay) return;
    if (lastClaimedFpRef.current !== winnerBannerDisplay.fp) {
      lastClaimedFpRef.current = winnerBannerDisplay.fp;
      rescue.reset();
    }
  }, [winnerBannerDisplay, rescue]);

  // After a successful rescue, dismiss the banner so we don't keep showing the CTA.
  useEffect(() => {
    if (rescue.stage !== "success") return;
    const fp = winnerBannerDisplay?.fp;
    if (fp == null) return;
    const t = setTimeout(() => {
      writeDismissedWinnerFp(fp);
      setDismissedWinnerFp(fp);
      clearWinnerHighlight();
      setWinnerHighlight(null);
    }, 1500);
    return () => clearTimeout(t);
  }, [rescue.stage, winnerBannerDisplay?.fp]);

  const handleClaimWarplet = useCallback(() => {
    if (!winnerBannerDisplay) return;
    void rescue.claim(winnerBannerDisplay.tokenId);
  }, [rescue, winnerBannerDisplay]);

  // No explicit gate here: the banner only renders when `winnerBannerDisplay` is set, which
  // requires either `chainWinnerBanner` (auctionSettled === true on-chain) or `winnerHighlight`
  // (only ever written *after* an awaited settle tx confirms). Both paths guarantee a
  // reservation exists, so the button is safe to enable whenever it's visible.
  const claimAction: ClaimAction | undefined = winnerBannerDisplay
    ? {
        visible: viewerIsWinner && rescue.ready,
        stage: rescue.stage,
        error: rescue.error,
        onClaim: handleClaimWarplet,
      }
    : undefined;

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
  const displayTopBidder: Address | null =
    idleNoChainAuction
      ? null
      : !liveAuction && userCompletedLocalBid && viewerAddress != null
        ? viewerAddress
        : chainTopBidder;

  const queuedRows = queueReadsEnabled
    ? stripQueueIds.map((id, i) => ({
        fid: Number(id),
        place: i + 2,
      }))
    : [];

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

  const handleChainBidSubmit = useCallback(async (amountWei: bigint) => {
    setChainBidError(null);
    bidLandGateRef.current = { sequence: false, success: false };
    bidSubmitSnapshotRef.current = {
      noBids: showNoBids,
      amount: topBidAmountStr,
      bidder: chainTopBidder,
    };
    try {
      await placeBid(amountWei, {
        onTransactionSubmitted: () => {
          setBidConfirmingOnChain(true);
          setBidFeedbackActive(true);
          const s = bidSubmitSnapshotRef.current;
          if (s.noBids) setBidHoldNoBidsUi(true);
          else setBidTopDisplayHold({ amount: s.amount, bidder: s.bidder });
        },
      });
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
  }, [
    placeBid,
    maybeBumpBidLandTick,
    clearBidTopDisplayHold,
    showNoBids,
    topBidAmountStr,
    chainTopBidder,
  ]);

  const handleSettlePaused = useCallback(async () => {
    setSettleError(null);
    expectNewLotAfterSettleRef.current = false;
    const snap = settledLotSnapshot(chainLot);
    try {
      await settleWhenPaused();
      if (snap) {
        writeWinnerHighlight(snap);
        setWinnerHighlight(snap);
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
        writeWinnerHighlight(snap);
        setWinnerHighlight(snap);
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

  const viewerIsHighBidderOnExpiredLot =
    liveAuction &&
    auctionExpired &&
    hasChainBid &&
    viewerAddress != null &&
    isAddressEqual(viewerAddress, chainLot.bidder);

  const expiredLotCaption = showExpiredPostAuction
    ? hasChainBid && !auctionPaused
      ? viewerIsHighBidderOnExpiredLot
        ? "You won — finalize to claim."
        : "Bidding closed. Anyone can finalize."
      : hasChainBid && auctionPaused
        ? viewerIsHighBidderOnExpiredLot
          ? "You won — finalize while paused."
          : "Bidding closed — anyone can finalize."
        : !hasChainBid && !auctionPaused
          ? "No bids — extend to reopen."
          : "No bids — unpause to extend."
    : null;

  /** Do not fold in `bidDisabled` — the page uses that to gate *bidding* (e.g. when expired), which would wrongly grey out extend / finalize. */
  const settlementDisabled = !isConnected || !!auctionReadError;

  /** Do not use `bidDisabled` — after settlement `minNextBidAmount` is null, which incorrectly marked bidding UI disabled. */
  const startNewDisabled =
    !isConnected || !!auctionReadError || auctionPaused;

  const chainSettlement =
    showExpiredPostAuction && hasChainBid && auctionPaused
      ? {
          label: "Finalize sale",
          onSubmit: handleSettlePaused,
          loading: settlePending,
          disabled: settlementDisabled,
          error: settleError,
          onClearError: () => setSettleError(null),
        }
      : showExpiredPostAuction && hasChainBid && !auctionPaused
        ? {
            label: "Finalize sale",
            onSubmit: handleSettleAndNext,
            loading: settlePending,
            disabled: settlementDisabled,
            error: settleError,
            onClearError: () => setSettleError(null),
          }
        : showExpiredPostAuction && !hasChainBid && !auctionPaused
          ? {
              label: "Extend listing time",
              hint: "Adds another full bidding window.",
              onSubmit: handleExtendAuction,
              loading: settlePending,
              disabled: settlementDisabled,
              error: settleError,
              onClearError: () => setSettleError(null),
            }
          : null;

  const bidInviteCopy =
    onChainMode &&
    liveAuction &&
    !auctionExpired &&
    showNoBids &&
    !auctionReadError
      ? "Want this Warplet? Place a bid below."
      : null;

  const onChainLiveQueueEmpty =
    queueReadsEnabled && liveAuction && chainQueuedIds.length === 0;

  const settledFooterCopy = !auctionSettled
    ? null
    : onChainMode && queueReadsEnabled && chainQueuedIds.length === 0
      ? "The last auction has ended. A new sale will begin when a Warplet joins the queue."
      : "The last auction has ended. Click to start a new auction.";

  return (
    <div className="w-full max-w-4xl">
      <BidFeedbackOverlay
        active={bidFeedbackActive}
        onSequenceComplete={onBidFeedbackSequenceComplete}
      />
      <h2 className="text-xl sm:text-3xl font-bold tracking-widest uppercase mb-1">
        Gobbled Warplet auctions
      </h2>
      <p className="text-sm text-base-content/40 mb-6 sm:mb-8">
        One auction per day. Everything behind the live lot is waiting in line
        to leave the Gobbler — not on sale until its day.
      </p>

      {showLastWinnerBanner && winnerBannerDisplay ? (
        <LastAuctionWinnerBanner
          tokenId={winnerBannerDisplay.tokenId}
          winnerAddress={winnerBannerDisplay.bidder}
          winAmountLabel={formatBidAmount(BigInt(winnerBannerDisplay.amountWei))}
          bidSymbol={bidSymbol}
          viewerAddress={viewerAddress}
          onDismiss={handleDismissWinnerBanner}
          claim={claimAction}
        />
      ) : null}

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
          showStartNewAuctionCta
            ? {
                onStart: () => void handleStartNewAuction(),
                disabled: startNewDisabled || startAuctionPending,
                loading: startAuctionPending,
                loadingStage: startAuctionLoadingStage,
                error: startError,
                housePaused: auctionPaused,
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
                parseHumanToWei,
                onSubmit: handleChainBidSubmit,
                loading: isBidding || rulesLoading || bidConfirmingOnChain,
                disabled: bidDisabled || rulesLoading || minBidWei == null,
                error: chainBidError,
                onClearTxError: () => setChainBidError(null),
                bidTokenPriceUsd,
              }
            : undefined
        }
        idleNoChainAuction={idleNoChainAuction}
        auctionExpiredOnChain={auctionExpired}
        contractPaused={auctionPaused}
        expiredLotCaption={expiredLotCaption}
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

      {onQueueEmptyBetweenSales ? (
        <div className="mt-10 rounded-xl border border-base-content/10 bg-base-100/10 px-4 py-5 sm:px-6">
          <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-base-content/55 mb-2">
            In line to exit the Gobbler
          </h3>
          <p className="text-sm text-base-content/55 leading-relaxed max-w-prose">
            The queue is empty. No Warplets are waiting for a future auction, so
            there is nothing to select, bump, or skip here. New NFTs will appear
            when they are queued on-chain.
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-base-content/50 mt-10 mb-1 text-center">
            In line to exit the Gobbler
          </h3>
          {queueReadsEnabled && onChainLiveQueueEmpty ? (
            <p className="text-xs text-base-content/40 mb-4 max-w-xl mx-auto text-center">
              No Warplets are queued behind this live lot. When more are lined
              up, they will show in the row below.
            </p>
          ) : skipLineOptionVisible ? (
            <p className="text-xs text-base-content/35 mb-4 max-w-xl mx-auto text-center">
              Tap a Warplet and help them skip the line.
            </p>
          ) : null}
          <div className="w-full flex flex-col items-center">
            <div className="w-full pb-2 pt-1 px-1">
              <div className="relative flex w-full min-h-[7rem] items-start justify-center gap-0 sm:min-h-[9rem]">
                <QueueBumpCutStrip
                  active={queueBumpBladeActive}
                  onSequenceComplete={() => bumpAfterBladeRef.current()}
                />
                {showQueueStripSkeleton ? (
                  <>
                    <QueueStripCellChrome
                      shuffleVersion={0}
                      slotIndex={0}
                      className="relative z-10 mr-2 shrink-0 sm:mr-3"
                    >
                      <AuctionQueueCardSkeleton />
                    </QueueStripCellChrome>
                    <div className="relative z-10 min-w-0 flex-1 overflow-x-auto overflow-y-visible scrollbar-hide snap-x snap-mandatory">
                      <div className="flex w-max min-w-full justify-center gap-2 sm:gap-2">
                        {Array.from({ length: QUEUE_STRIP_SKELETON_COUNT }, (_, i) => (
                          <QueueStripCellChrome
                            key={`queue-sk-${i}`}
                            shuffleVersion={0}
                            slotIndex={i + 1}
                            className="shrink-0 snap-center"
                          >
                            <AuctionQueueCardSkeleton />
                          </QueueStripCellChrome>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <QueueStripCellChrome
                      shuffleVersion={queueShuffleVersion}
                      slotIndex={0}
                      className="relative z-10 mr-2 shrink-0 sm:mr-3"
                    >
                      <AuctionQueueHeadSlot
                        bumpPhase={bumpVisualPhase}
                        selectionPreviewFid={
                          bumpVisualPhase === "idle" &&
                          selectedInQueueFid != null &&
                          selectedQueueIdx > 0
                            ? selectedInQueueFid
                            : null
                        }
                        bumpPreviewFid={bumpAnimatingFid}
                      />
                    </QueueStripCellChrome>
                    <div
                      ref={queueStripScrollRef}
                      className="relative z-10 min-w-0 flex-1 overflow-x-auto overflow-y-visible scrollbar-hide snap-x snap-mandatory"
                    >
                      <div className="flex w-max min-w-full justify-center gap-2 sm:gap-2">
                        {queuedRows.map((row, i) => (
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
                                  selectedQueueFid === row.fid
                                    ? null
                                    : row.fid,
                                )
                              }
                            />
                          </QueueStripCellChrome>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {showBumpPanel && (
              <div className="mt-7 sm:mt-8 w-full flex justify-center">
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
          </div>
        </>
      )}
    </div>
  );
}
