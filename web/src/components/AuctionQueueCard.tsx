"use client";

import AuctionWarpletImage from "./AuctionWarpletImage";

export default function AuctionQueueCard({
  fid,
  placeInLine,
  isSelected,
  onSelect,
}: {
  fid: number;
  placeInLine: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-shrink-0 w-[7.5rem] sm:w-[8.5rem] rounded-xl border bg-base-100/25 p-2 flex flex-col items-center gap-2 text-left transition-colors cursor-pointer
        ${
          isSelected
            ? "border-secondary ring-2 ring-secondary/40 shadow-lg shadow-secondary/15"
            : "border-base-content/10 hover:border-secondary/35"
        }`}
    >
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-base-content/45">
        #{placeInLine} in line
      </span>
      <div className="w-full rounded-lg overflow-hidden bg-base-200/30 pointer-events-none">
        <AuctionWarpletImage fid={fid} variant="thumb" />
      </div>
    </button>
  );
}
