"use client";

export default function AuctionQueueBumpPanel({
  selectedTokenId,
  bumpAmountDisplay,
  bidSymbol,
  alreadyFirst,
  bumpLiveReady,
  bumpDisabled,
  bumpHint,
  onBump,
  isBumping,
}: {
  selectedTokenId: number;
  bumpAmountDisplay: string;
  bidSymbol: string;
  alreadyFirst: boolean;
  /** On-chain linked-list AuctionSell + ERC777 bid token reads succeeded — wallet tx will work. */
  bumpLiveReady: boolean;
  bumpDisabled: boolean;
  bumpHint?: string | null;
  onBump: () => void;
  isBumping: boolean;
}) {
  const buttonDisabled =
    bumpDisabled || isBumping || !bumpLiveReady;

  return (
    <div className="mt-8 pt-6 border-t border-base-content/10">
      <p className="text-xs font-medium text-base-content/60 mb-1">
        Warplet #{selectedTokenId}
      </p>
      {alreadyFirst ? (
        <p className="text-xs text-base-content/45 max-w-xl">
          This one is already first in the exit queue. Select a Warplet further
          back in the row to see the{" "}
          <strong className="font-semibold text-base-content/55">Skip the line</strong>{" "}
          button there.
        </p>
      ) : (
        <>
          <p className="text-xs text-base-content/45 mb-3 max-w-xl">
            Pay the queue bump fee (ERC777 <code className="text-[10px]">send</code>{" "}
            with encoded token id and predecessor) to move this NFT to the head of
            the line.
          </p>
          {!bumpLiveReady && (
            <p className="text-xs text-base-content/50 mb-3 max-w-xl">
              Preview only: set <code className="text-[10px]">NEXT_PUBLIC_AUCTION_SELL_ADDRESS</code>{" "}
              to a linked-list AuctionSell with <code className="text-[10px]">queueBumpFee</code>{" "}
              and an ERC-777 <code className="text-[10px]">bidToken</code> to pay for real.
            </p>
          )}
          {bumpHint && (
            <p className="text-xs text-warning/90 mb-2 max-w-xl">{bumpHint}</p>
          )}
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            disabled={buttonDisabled}
            onClick={onBump}
          >
            {isBumping
              ? "Confirm in wallet…"
              : `Pay ${bumpAmountDisplay} ${bidSymbol} · skip the line`}
          </button>
        </>
      )}
    </div>
  );
}
