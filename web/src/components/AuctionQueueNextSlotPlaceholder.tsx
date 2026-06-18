"use client";

/** Same tile size as bump preview — reserved column when no skip preview is active. */
export default function AuctionQueueNextSlotPlaceholder() {
  return (
    <div
      className="relative box-border flex h-full w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-base-content/[0.12] bg-base-100/[0.02] pointer-events-none"
      aria-label="Next in line. Select a Warplet behind the front to preview skipping ahead."
    />
  );
}
