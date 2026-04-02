"use client";

export default function AuctionQueueSkipCta({
  selectedWarpletTokenId,
  amountDisplay,
  bidSymbol,
}: {
  selectedWarpletTokenId: number | null;
  amountDisplay: string;
  bidSymbol: string;
}) {
  if (selectedWarpletTokenId == null) return null;

  return (
    <div className="mt-8 pt-6 border-t border-base-content/10">
      <p className="text-xs text-base-content/45 mb-3 max-w-xl">
        Use a queued Warplet from the picker above (Gobbler section) to unlock
        paying the skip fee and jumping toward the front.
      </p>
      <button
        type="button"
        className="btn btn-outline btn-secondary w-full sm:w-auto"
        disabled
      >
        Pay {amountDisplay} {bidSymbol} and skip the queue
      </button>
    </div>
  );
}
