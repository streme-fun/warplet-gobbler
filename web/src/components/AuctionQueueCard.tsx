"use client";

import AuctionWarpletImage from "./AuctionWarpletImage";

export default function AuctionQueueCard({
  fid,
  placeInLine,
  isSelected,
  isNext,
  onSelect,
}: {
  fid: number;
  placeInLine: number;
  isSelected: boolean;
  isNext?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={isNext ? undefined : onSelect}
      disabled={isNext}
      className={`flex-shrink-0 w-20 sm:w-24 rounded-xl border bg-base-100/25 p-1.5 flex flex-col items-center gap-1 transition-colors
        ${
          isSelected
            ? "border-secondary ring-2 ring-secondary/40 shadow-lg shadow-secondary/15 cursor-pointer"
            : isNext
              ? "border-primary/30 cursor-default"
              : "border-base-content/10 hover:border-secondary/35 cursor-pointer"
        }`}
    >
      <span
        className={`text-[8px] sm:text-[9px] uppercase tracking-wider ${
          isNext ? "text-primary/70 font-semibold" : "text-base-content/45"
        }`}
      >
        {isNext ? "Next up" : `#${placeInLine} in line`}
      </span>
      <div className="relative w-full rounded-lg overflow-hidden bg-base-200/30 pointer-events-none">
        <AuctionWarpletImage fid={fid} variant="thumb" />
        <span className="absolute bottom-0 inset-x-0 text-[8px] sm:text-[9px] py-0.5 text-center bg-black/60 text-base-content/70">
          #{fid}
        </span>
      </div>
    </button>
  );
}
