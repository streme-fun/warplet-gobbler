"use client";

import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import AuctionLiveHero from "./AuctionLiveHero";
import AuctionQueueCard from "./AuctionQueueCard";
import AuctionQueueSkipCta from "./AuctionQueueSkipCta";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";
import {
  MOCK_AUCTIONS,
  MOCK_FALLBACK_TOP_BID_STRAT,
  MOCK_FALLBACK_TOP_BIDDER,
  MOCK_SKIP_QUEUE_FEE_STRAT,
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
  selectedWarpletTokenId,
}: {
  /** FIDs where the user completed the local bid animation (demo / optimistic). */
  auctionBidPlacedFids: Set<number>;
  onBid?: (
    fid: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  bidDisabled?: boolean;
  /** Gobbler picker selection — skip-queue CTA only appears when set. */
  selectedWarpletTokenId: number | null;
}) {
  const { address: viewerAddress } = useAccount();
  const [live, ...queued] = MOCK_AUCTIONS;
  const {
    configured: auctionSellConfigured,
    auction: chainLot,
    formatBidAmount,
    bidSymbol,
    isError: auctionReadError,
    skipQueueFeeAmountStr,
  } = useAuctionSellAuction();

  const useChain =
    auctionSellConfigured &&
    !auctionReadError &&
    chainLot != null &&
    chainLot.tokenId > 0n;

  const { data: chainQueuedIds = [] } = useAuctionSellQueue({
    enabled: useChain,
    excludeTokenId: chainLot?.tokenId,
  });

  const displayTokenId = useChain
    ? Number(chainLot.tokenId)
    : live.fid;

  const hasChainBid =
    useChain &&
    chainLot.amount > 0n &&
    !isAddressEqual(chainLot.bidder, zeroAddress);

  const topBidAmountStr = useChain
    ? hasChainBid
      ? formatBidAmount(chainLot.amount)
      : "0"
    : MOCK_FALLBACK_TOP_BID_STRAT;

  const chainTopBidder: Address | null = useChain
    ? hasChainBid
      ? chainLot.bidder
      : null
    : (MOCK_FALLBACK_TOP_BIDDER as Address);

  const showNoBids = useChain && !hasChainBid && !chainLot.settled;

  const auctionSettled = useChain && chainLot.settled;

  const countdownEndUnix = useChain
    ? Number(chainLot.endTime)
    : undefined;
  const countdownDurationSecs = useChain ? undefined : live.endsSecs;

  const userCompletedLocalBid = auctionBidPlacedFids.has(displayTokenId);

  const leadingOnChain =
    useChain &&
    viewerAddress != null &&
    hasChainBid &&
    isAddressEqual(chainLot.bidder, viewerAddress);

  const viewerIsLeadingBidder =
    leadingOnChain ||
    (userCompletedLocalBid && (!useChain || hasChainBid));

  /** After the demo bid animation (mock), show the viewer when connected; on-chain use lot bidder. */
  const displayTopBidder: Address | null =
    !useChain && userCompletedLocalBid && viewerAddress != null
      ? viewerAddress
      : chainTopBidder;

  const queuedRows =
    useChain && chainQueuedIds.length > 0
      ? chainQueuedIds.map((id, i) => ({
          fid: Number(id),
          place: i + 2,
        }))
      : queued.map((a, i) => ({
          fid: a.fid,
          place: i + 2,
        }));

  const skipFeeHuman = humanSkipFee(
    auctionSellConfigured && !auctionReadError
      ? skipQueueFeeAmountStr
      : null,
    MOCK_SKIP_QUEUE_FEE_STRAT,
  );

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
        These Warplets are gobbled and queued. They are not on auction until they
        become the daily lot.
      </p>
      <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {queuedRows.map((row) => (
          <AuctionQueueCard
            key={row.fid}
            fid={row.fid}
            placeInLine={row.place}
          />
        ))}
      </div>

      <AuctionQueueSkipCta
        selectedWarpletTokenId={selectedWarpletTokenId}
        amountDisplay={skipFeeHuman}
        bidSymbol={AUCTION_BID_TOKEN_SYMBOL}
      />
    </div>
  );
}
