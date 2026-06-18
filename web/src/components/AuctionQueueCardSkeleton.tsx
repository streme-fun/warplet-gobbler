"use client";

/** Same footprint as `AuctionQueueCard` — placeholder while queue or auction data loads. */
export default function AuctionQueueCardSkeleton({
  size = "regular",
}: {
  size?: "regular" | "compact";
}) {
  const compact = size === "compact";

  return (
    <div
      className={`relative aspect-square w-full flex-shrink-0 overflow-hidden border-2 border-base-content/10 pointer-events-none ${
        compact ? "rounded-lg" : "rounded-xl"
      }`}
      aria-hidden
    >
      <div
        className={`pointer-events-none absolute left-1 top-1 z-10 rounded-md skeleton opacity-70 ${
          compact ? "h-3 w-5 sm:h-4 sm:w-6" : "h-5 w-7 sm:h-6 sm:w-8"
        }`}
      />
      <div className="absolute inset-0 skeleton rounded-none" />
      <span
        className={`pointer-events-none absolute bottom-0 inset-x-0 z-10 skeleton rounded-none border-t border-base-content/5 ${
          compact ? "h-3" : "h-[22px]"
        }`}
      />
    </div>
  );
}
