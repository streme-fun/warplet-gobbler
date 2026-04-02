"use client";

import AuctionWarpletImage from "./AuctionWarpletImage";

export default function AuctionQueueCard({
  fid,
  placeInLine,
}: {
  fid: number;
  placeInLine: number;
}) {
  return (
    <div className="flex-shrink-0 w-[7.5rem] sm:w-[8.5rem] rounded-xl border border-base-content/10 bg-base-100/25 p-2 flex flex-col items-center gap-2">
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-base-content/45">
        #{placeInLine} in line
      </span>
      <div className="w-full rounded-lg overflow-hidden bg-base-200/30">
        <AuctionWarpletImage fid={fid} variant="thumb" />
      </div>
    </div>
  );
}
