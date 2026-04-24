"use client";

import { useModal } from "connectkit";
import { useAccount } from "wagmi";

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
  const { isConnected } = useAccount();
  const { setOpen: setConnectModalOpen } = useModal();
  const walletDisconnected = !isConnected;
  const buttonDisabled =
    !hasQueueSelection ||
    alreadyFirst ||
    isBumping ||
    !bumpLiveReady ||
    (!walletDisconnected && bumpDisabled);
  const tokenLabel = bidSymbol.startsWith("$") ? bidSymbol : `$${bidSymbol}`;
  /** Filled CTA only when a real skip is available (not e.g. dev CTA unplugged). */
  const filledSecondary =
    hasQueueSelection &&
    !alreadyFirst &&
    bumpLiveReady &&
    (walletDisconnected || !bumpDisabled);

  const buttonLabel = isBumping ? (
    "Confirm…"
  ) : walletDisconnected && hasQueueSelection && !alreadyFirst ? (
    "Connect Wallet to Skip the Line"
  ) : alreadyFirst ? (
    "Already #1 in line"
  ) : hasQueueSelection ? (
    <span className="inline-flex items-center gap-1.5">
      <span>Skip the line</span>
      <span className="text-secondary/60">·</span>
      <span className="font-semibold tabular-nums text-secondary/90">
        1M {tokenLabel}
      </span>
    </span>
  ) : (
    "Pick a Warplet to skip the line"
  );

  return (
    <div className="w-full flex flex-col items-center gap-2 text-center">
      {bumpHint ? (
        <p className="text-xs text-warning/90 max-w-md mx-auto break-words">
          {bumpHint}
        </p>
      ) : null}
      {alreadyFirst ? (
        <p className="max-w-sm text-xs leading-snug text-base-content/55">
          This Warplet is already at the front of the queue. Pick one behind
          them to skip the line.
        </p>
      ) : null}
      <button
        type="button"
        className={`btn btn-sm w-full max-w-sm mx-auto text-sm font-medium normal-case tracking-normal transition-colors ${
          filledSecondary
            ? "btn-outline btn-secondary hover:bg-secondary/15"
            : "btn-ghost border border-base-content/15 text-base-content/55 hover:bg-base-content/5"
        }`}
        disabled={buttonDisabled}
        onClick={walletDisconnected ? () => setConnectModalOpen(true) : onBump}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
