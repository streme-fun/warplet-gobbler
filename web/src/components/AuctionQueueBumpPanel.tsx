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
  const buttonDisabled = bumpDisabled || isBumping || !bumpLiveReady;

  return (
    <div className="mt-4">
      {alreadyFirst ? (
        <p className="text-xs text-base-content/45 max-w-xl">
          This one is already first in the exit queue. Select a Warplet further
          back in the row to see the{" "}
          <strong className="font-semibold text-base-content/55">
            Skip the line
          </strong>{" "}
          button there.
        </p>
      ) : (
        <>
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
