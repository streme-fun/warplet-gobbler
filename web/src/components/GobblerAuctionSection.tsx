"use client";

import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import AuctionLiveHero from "./AuctionLiveHero";
import LastAuctionWinnerBanner, {
  getWinnerFingerprint,
  readDismissedWinnerFp,
  writeDismissedWinnerFp,
} from "./LastAuctionWinnerBanner";
import AuctionQueueCard from "./AuctionQueueCard";
import AuctionQueueBumpPanel from "./AuctionQueueBumpPanel";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellBid } from "@/hooks/useAuctionSellBid";
import { useAuctionSellSettleActions } from "@/hooks/useAuctionSellSettle";
import { useAuctionSellStartAuction } from "@/hooks/useAuctionSellStartAuction";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { useAuctionQueueBump } from "@/hooks/useAuctionQueueBump";
import { useWarpgobbUsdPrice } from "@/hooks/useDutchAuction";
import { CONTRACTS } from "@/lib/contracts";
import { formatUserFacingTxError } from "@/lib/format-tx-error";
import {
  MOCK_AUCTIONS,
  MOCK_FALLBACK_TOP_BID_AMOUNT,
  MOCK_FALLBACK_TOP_BIDDER,
  MOCK_SKIP_QUEUE_FEE,
} from "@/lib/mock-data";

function humanSkipFee(amountStr: string | null, mockNumber: number): string {
  if (amountStr != null) {
    return amountStr;
  }
  return mockNumber.toLocaleString(undefined, { maximumFractionDigits: 6 });
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
  const [live, ...queued] = MOCK_AUCTIONS;
  const [selectedQueueFid, setSelectedQueueFid] = useState<number | null>(null);
  const [bumpError, setBumpError] = useState<string | null>(null);
  const [chainBidError, setChainBidError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [extendSuccessTick, setExtendSuccessTick] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [dismissedWinnerFp, setDismissedWinnerFp] = useState<string | null>(
    () => (typeof window !== "undefined" ? readDismissedWinnerFp() : null),
  );
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
    skipQueueFeeAmountStr,
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
    auctionSellConfigured && !auctionReadError && chainLot != null;

  const liveAuction =
    hasParsedLot && chainLot.tokenId > 0n && !chainLot.settled;

  const idleNoChainAuction =
    hasParsedLot && chainLot.startTime === 0n && !chainLot.settled;

  /** Must use bigint vs chain time — mock countdown must not be the only signal of expiry. */
  const auctionExpired =
    liveAuction && chainLot != null && BigInt(nowUnix) >= chainLot.endTime;

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
  const { data: chainQueuedIds = [], refetch: refetchQueue } =
    useAuctionSellQueue({
      enabled: queueReadsEnabled,
    });

  const {
    settleWhenPaused,
    settleAndStartNext,
    extendAuction,
    isPending: settlePending,
  } = useAuctionSellSettleActions({
    refetchAuction,
    refetchQueue,
  });

  const { startAuction, isPending: startAuctionPending } =
    useAuctionSellStartAuction({
      refetchAuction,
      refetchQueue,
    });

  const { sendBumpTx, isPending: isBumping } = useAuctionQueueBump();

  const displayTokenId = idleNoChainAuction
    ? 0
    : hasParsedLot && chainLot.tokenId > 0n
      ? Number(chainLot.tokenId)
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
        : MOCK_FALLBACK_TOP_BID_AMOUNT;

  const chainTopBidder: Address | null = liveAuction
    ? hasChainBid
      ? chainLot.bidder
      : null
    : auctionSettled && chainLot.amount > 0n
      ? chainLot.bidder
      : (MOCK_FALLBACK_TOP_BIDDER as Address);

  const showNoBids = !idleNoChainAuction && liveAuction && !hasChainBid;

  const hasLastSettledWinner =
    hasParsedLot &&
    auctionSettled &&
    chainLot.tokenId > 0n &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const winnerFingerprint =
    hasLastSettledWinner && chainLot
      ? getWinnerFingerprint(chainLot.tokenId, chainLot.bidder, chainLot.amount)
      : null;

  const showLastWinnerBanner = Boolean(
    onChainMode && winnerFingerprint && winnerFingerprint !== dismissedWinnerFp,
  );

  const onQueueEmptyBetweenSales =
    queueReadsEnabled &&
    chainQueuedIds.length === 0 &&
    !liveAuction &&
    onChainMode;

  const canManualStartNewAuction =
    onChainMode &&
    !auctionReadError &&
    !auctionPaused &&
    !liveAuction &&
    chainQueuedIds.length > 0 &&
    (auctionSettled || idleNoChainAuction);

  const handleDismissWinnerBanner = useCallback(() => {
    if (!winnerFingerprint) return;
    writeDismissedWinnerFp(winnerFingerprint);
    setDismissedWinnerFp(winnerFingerprint);
  }, [winnerFingerprint]);

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

  const queuedRows = queueReadsEnabled
    ? chainQueuedIds.map((id, i) => ({
        fid: Number(id),
        place: i + 2,
      }))
    : queued.map((a, i) => ({
        fid: a.fid,
        place: i + 2,
      }));

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
      ? chainQueuedIds[selectedQueueIdx - 1]!
      : null;

  const alreadyFirst = selectedQueueIdx === 0;

  const bumpLiveReady =
    queueReadsEnabled && queueBumpReady && selectedQueueIdx > 0;

  useEffect(() => {
    if (selectedQueueFid == null) return;
    if (!queuedRows.some((r) => r.fid === selectedQueueFid)) {
      setSelectedQueueFid(null);
    }
  }, [queuedRows, selectedQueueFid, setSelectedQueueFid]);

  const skipFeeHuman = humanSkipFee(
    auctionSellConfigured && !auctionReadError ? skipQueueFeeAmountStr : null,
    MOCK_SKIP_QUEUE_FEE,
  );

  const handleQueueBump = useCallback(async () => {
    setBumpError(null);
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
      await refetchQueue();
    } catch (e) {
      setBumpError(formatUserFacingTxError(e));
    }
  }, [
    bidTokenAddress,
    prevBigint,
    publicClient,
    queueBumpFeeWei,
    queueBumpReady,
    refetchQueue,
    selectedInQueueFid,
    sendBumpTx,
  ]);

  const showBumpPanel = selectedInQueueFid != null && selectedQueueIdx >= 0;

  const handleChainBidSubmit = useCallback(
    async (amountWei: bigint) => {
      setChainBidError(null);
      try {
        await placeBid(amountWei);
      } catch (e) {
        setChainBidError(formatUserFacingTxError(e));
      }
    },
    [placeBid],
  );

  const handleSettlePaused = useCallback(async () => {
    setSettleError(null);
    try {
      await settleWhenPaused();
    } catch (e) {
      setSettleError(formatUserFacingTxError(e));
    }
  }, [settleWhenPaused]);

  const handleSettleAndNext = useCallback(async () => {
    setSettleError(null);
    try {
      await settleAndStartNext();
    } catch (e) {
      setSettleError(formatUserFacingTxError(e));
    }
  }, [settleAndStartNext]);

  const handleExtendAuction = useCallback(async () => {
    setSettleError(null);
    try {
      await extendAuction();
      setExtendSuccessTick((n) => n + 1);
    } catch (e) {
      setSettleError(formatUserFacingTxError(e));
    }
  }, [extendAuction]);

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

  const startNewDisabled =
    !isConnected || Boolean(bidDisabled) || !!auctionReadError;

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

  return (
    <div className="w-full max-w-4xl">
      {auctionSellConfigured && auctionReadError ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error/95"
        >
          Could not read the auction contract from this network. Confirm{" "}
          <code className="text-xs break-all">
            NEXT_PUBLIC_AUCTION_SELL_ADDRESS
          </code>{" "}
          and that your wallet is on Base. Finalize / bid controls stay hidden
          until the lot loads.
        </div>
      ) : null}

      {showLastWinnerBanner &&
        hasLastSettledWinner &&
        chainLot &&
        winnerFingerprint && (
          <LastAuctionWinnerBanner
            tokenId={Number(chainLot.tokenId)}
            winnerAddress={chainLot.bidder}
            winAmountLabel={formatBidAmount(chainLot.amount)}
            bidSymbol={bidSymbol}
            viewerAddress={viewerAddress}
            onDismiss={handleDismissWinnerBanner}
          />
        )}

      {canManualStartNewAuction && (
        <div className="w-full max-w-4xl space-y-2 -mt-2 mb-6">
          <button
            type="button"
            onClick={() => void handleStartNewAuction()}
            disabled={startNewDisabled || startAuctionPending}
            className="btn btn-secondary btn-outline w-full sm:w-auto min-w-[220px] font-semibold tracking-wide disabled:opacity-50"
          >
            {startAuctionPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Start new auction"
            )}
          </button>
          {startError ? (
            <p className="text-xs text-error/90 break-words">{startError}</p>
          ) : (
            <p className="text-xs text-base-content/45 max-w-xl">
              Pulls the next Warplet from the queue into a fresh timed auction.
            </p>
          )}
        </div>
      )}

      <AuctionLiveHero
        displayTokenId={displayTokenId}
        topBidAmountStr={topBidAmountStr}
        bidSymbol={bidSymbol}
        topBidder={displayTopBidder}
        viewerAddress={viewerAddress}
        showNoBids={showNoBids}
        countdownEndUnix={countdownEndUnix}
        countdownDurationSecs={countdownDurationSecs}
        auctionSettled={auctionSettled}
        bidDisabled={bidDisabled}
        onBid={chainBidActive ? undefined : onBid}
        chainBid={
          chainBidActive
            ? {
                minBidHuman,
                minBidWei,
                parseHumanToWei,
                onSubmit: handleChainBidSubmit,
                loading: isBidding || rulesLoading,
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
        countdownResetKey={
          chainCountdownLive && chainLot != null
            ? chainLot.endTime.toString()
            : undefined
        }
      />

      {onQueueEmptyBetweenSales ? (
        <div className="mt-4 rounded-xl border border-base-content/10 bg-base-100/10 px-4 py-5 sm:px-6">
          <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-base-content/55 mb-2">
            Up next
          </h3>
          <p className="text-sm text-base-content/55 leading-relaxed max-w-prose">
            The queue is empty. New Warplets will appear here when queued
            on-chain.
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-base-content/50 mt-4 mb-1">
            Up next
          </h3>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-base-content/35 max-w-xl">
              {queueReadsEnabled && onChainLiveQueueEmpty
                ? "No Warplets queued behind this lot yet."
                : `Tap a Warplet to pay ${skipFeeHuman} ${bidSymbol} and move it to the front.`}
            </p>
            <div className="flex gap-1 shrink-0 ml-2">
              <button
                onClick={() => {
                  const el = document.getElementById("queue-scroll");
                  if (el) el.scrollBy({ left: -200, behavior: "smooth" });
                }}
                className="w-7 h-7 rounded-full border border-base-content/15 flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("queue-scroll");
                  if (el) el.scrollBy({ left: 200, behavior: "smooth" });
                }}
                className="w-7 h-7 rounded-full border border-base-content/15 flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
          <div
            id="queue-scroll"
            className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
          >
            {queuedRows.map((row, i) => (
              <AuctionQueueCard
                key={row.fid}
                fid={row.fid}
                placeInLine={row.place}
                isSelected={selectedInQueueFid === row.fid}
                isNext={i === 0}
                onSelect={() =>
                  setSelectedQueueFid(
                    selectedQueueFid === row.fid ? null : row.fid,
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {showBumpPanel && (
        <AuctionQueueBumpPanel
          selectedTokenId={selectedInQueueFid}
          bumpAmountDisplay={skipFeeHuman}
          bidSymbol={bidSymbol}
          alreadyFirst={alreadyFirst}
          bumpLiveReady={bumpLiveReady}
          bumpDisabled={!isConnected || Boolean(bidDisabled)}
          bumpHint={bumpError}
          onBump={handleQueueBump}
          isBumping={isBumping}
        />
      )}
    </div>
  );
}
