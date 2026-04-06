"use client";

import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import AuctionLiveHero from "./AuctionLiveHero";
import AuctionQueueCard from "./AuctionQueueCard";
import AuctionQueueBumpPanel from "./AuctionQueueBumpPanel";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { useAuctionQueueBump } from "@/hooks/useAuctionQueueBump";
import { CONTRACTS } from "@/lib/contracts";
import {
  MOCK_AUCTIONS,
  MOCK_FALLBACK_TOP_BID_AMOUNT,
  MOCK_FALLBACK_TOP_BIDDER,
  MOCK_SKIP_QUEUE_FEE,
} from "@/lib/mock-data";

function humanSkipFee(amountStr: string | null, mockNumber: number): string {
  if (amountStr != null) {
    const n = Number.parseFloat(amountStr);
    if (Number.isFinite(n)) {
      return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
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

  const {
    configured: auctionSellConfigured,
    auction: chainLot,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    skipQueueFeeAmountStr,
    queueBumpFeeWei,
    queueBumpReady,
    bidTokenAddress,
  } = useAuctionSellAuction();

  const hasParsedLot =
    auctionSellConfigured &&
    !auctionReadError &&
    chainLot != null;

  const liveAuction =
    hasParsedLot &&
    chainLot.tokenId > 0n &&
    !chainLot.settled;

  const queueReadsEnabled = auctionSellConfigured && !auctionReadError;
  const { data: chainQueuedIds = [], refetch: refetchQueue } =
    useAuctionSellQueue({
      enabled: queueReadsEnabled,
    });

  const { sendBumpTx, isPending: isBumping } = useAuctionQueueBump();

  const displayTokenId =
    hasParsedLot && chainLot.tokenId > 0n
      ? Number(chainLot.tokenId)
      : live.fid;

  const hasChainBid =
    liveAuction &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const topBidAmountStr = liveAuction
    ? hasChainBid
      ? formatBidAmount(chainLot.amount)
      : "0"
    : MOCK_FALLBACK_TOP_BID_AMOUNT;

  const chainTopBidder: Address | null = liveAuction
    ? hasChainBid
      ? chainLot.bidder
      : null
    : (MOCK_FALLBACK_TOP_BIDDER as Address);

  const showNoBids = liveAuction && !hasChainBid;

  const auctionSettled = hasParsedLot && chainLot.settled;

  const countdownEndUnix = liveAuction
    ? Number(chainLot.endTime)
    : undefined;
  const countdownDurationSecs = liveAuction ? undefined : live.endsSecs;

  const userCompletedLocalBid = auctionBidPlacedFids.has(displayTokenId);

  const leadingOnChain =
    liveAuction &&
    viewerAddress != null &&
    hasChainBid &&
    isAddressEqual(chainLot.bidder, viewerAddress);

  const viewerIsLeadingBidder =
    leadingOnChain ||
    (userCompletedLocalBid && (!liveAuction || hasChainBid));

  /** After the demo bid animation (mock), show the viewer when connected; on-chain use lot bidder. */
  const displayTopBidder: Address | null =
    !liveAuction && userCompletedLocalBid && viewerAddress != null
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
    queueReadsEnabled &&
    queueBumpReady &&
    selectedQueueIdx > 0;

  useEffect(() => {
    if (selectedQueueFid == null) return;
    if (!queuedRows.some((r) => r.fid === selectedQueueFid)) {
      setSelectedQueueFid(null);
    }
  }, [queuedRows, selectedQueueFid, setSelectedQueueFid]);

  const skipFeeHuman = humanSkipFee(
    auctionSellConfigured && !auctionReadError
      ? skipQueueFeeAmountStr
      : null,
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
      setBumpError(e instanceof Error ? e.message : "Transaction failed");
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

  const showBumpPanel =
    selectedInQueueFid != null && selectedQueueIdx >= 0;

  return (
    <div className="w-full max-w-4xl rounded-2xl bg-base-200/40 border border-secondary/10 backdrop-blur-sm p-6 sm:p-10">
      <h2 className="text-xl sm:text-3xl font-bold tracking-widest uppercase mb-1">
        Gobbled Warplet auctions
      </h2>
      <p className="text-sm text-base-content/40 mb-6 sm:mb-8">
        One auction per day. Everything behind the live lot is waiting in line
        to leave the Gobbler — not on sale until its day.
      </p>

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
        viewerIsLeadingBidder={viewerIsLeadingBidder}
        bidDisabled={bidDisabled}
        onBid={onBid}
      />

      <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-base-content/50 mt-10 mb-1">
        In line to exit the Gobbler
      </h3>
      <p className="text-xs text-base-content/35 mb-4 max-w-xl">
        Tap a Warplet in the row below (not #2 in line — pick one further back),
        then use <strong className="font-semibold text-base-content/55">Skip the line</strong>{" "}
        to pay the bump fee (<code className="text-[10px]">send</code> + userData).
      </p>
      <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {queuedRows.map((row) => (
          <AuctionQueueCard
            key={row.fid}
            fid={row.fid}
            placeInLine={row.place}
            isSelected={selectedInQueueFid === row.fid}
            onSelect={() =>
              setSelectedQueueFid(
                selectedQueueFid === row.fid ? null : row.fid,
              )
            }
          />
        ))}
      </div>
      {queueReadsEnabled && chainQueuedIds.length === 0 && (
        <p className="text-xs text-base-content/40 py-2">
          No Warplets in the on-chain queue yet.
        </p>
      )}

      {showBumpPanel && (
        <AuctionQueueBumpPanel
          selectedTokenId={selectedInQueueFid}
          bumpAmountDisplay={skipFeeHuman}
          bidSymbol={bidSymbol}
          alreadyFirst={alreadyFirst}
          bumpLiveReady={bumpLiveReady}
          bumpDisabled={!isConnected || bidDisabled}
          bumpHint={bumpError}
          onBump={handleQueueBump}
          isBumping={isBumping}
        />
      )}
    </div>
  );
}
