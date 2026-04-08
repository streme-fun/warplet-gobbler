"use client";

/** Same footprint as `AuctionQueueCard` — placeholder while queue or auction data loads. */
export default function AuctionQueueCardSkeleton() {
  return (
    <div
      className="relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 border-base-content/10 snap-center pointer-events-none"
      aria-hidden
    >
      <div className="pointer-events-none absolute left-1 top-1 z-10 h-5 w-7 rounded-md skeleton opacity-70 sm:h-6 sm:w-8" />
      <div className="absolute inset-0 skeleton rounded-none" />
      <span className="pointer-events-none absolute bottom-0 inset-x-0 z-10 h-[22px] skeleton rounded-none border-t border-base-content/5" />
    </div>
  );
}
