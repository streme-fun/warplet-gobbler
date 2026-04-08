"use client";

export default function AuctionQueueBumpPanel({
  bidSymbol,
  hasQueueSelection,
  alreadyFirst,
  bumpLiveReady,
  bumpDisabled,
  bumpHint,
  onBump,
  isBumping,
}: {
  bidSymbol: string;
  /** Matches sell row: filled secondary only after a queue tile is selected. */
  hasQueueSelection: boolean;
  alreadyFirst: boolean;
  /** On-chain linked-list AuctionSell + ERC777 bid token reads succeeded — wallet tx will work. */
  bumpLiveReady: boolean;
  bumpDisabled: boolean;
  bumpHint?: string | null;
  onBump: () => void;
  isBumping: boolean;
}) {
  const buttonDisabled =
    !hasQueueSelection ||
    alreadyFirst ||
    bumpDisabled ||
    isBumping ||
    !bumpLiveReady;
  const tokenLabel = bidSymbol.startsWith("$") ? bidSymbol : `$${bidSymbol}`;
  /** Filled CTA only when a real skip is available (not e.g. dev CTA unplugged). */
  const filledSecondary =
    hasQueueSelection && !alreadyFirst && bumpLiveReady && !bumpDisabled;

  const buttonLabel = isBumping
    ? "Confirm…"
    : alreadyFirst
      ? "Already #1 in line"
      : "Skip the line";

  return (
    <div className="w-full flex flex-col items-center gap-2 text-center">
      {bumpHint ? (
        <p className="text-xs text-warning/90 max-w-md mx-auto break-words">
          {bumpHint}
        </p>
      ) : null}
      <div className="flex min-h-[3rem] w-full max-w-sm flex-col items-center justify-center px-1">
        {alreadyFirst ? (
          <p className="text-sm leading-snug text-base-content/55">
            This Warplet is already at the front of the queue. Pick one behind
            them to skip the line.
          </p>
        ) : (
          <p className="text-sm leading-snug text-base-content/70">
            Pay 1M{" "}
            <span className="font-semibold tabular-nums text-secondary/95">
              {tokenLabel}
            </span>
          </p>
        )}
      </div>
      <button
        type="button"
        className={`btn w-full max-w-sm mx-auto mt-1 transition-shadow ${
          filledSecondary
            ? "btn-secondary hover:shadow-lg hover:shadow-secondary/25"
            : "border border-secondary/30 text-secondary/50 hover:border-secondary/50 hover:text-secondary/70"
        }`}
        disabled={buttonDisabled}
        onClick={onBump}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
