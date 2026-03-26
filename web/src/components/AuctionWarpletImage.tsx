"use client";

/* eslint-disable @next/next/no-img-element */

export default function AuctionWarpletImage({ fid }: { fid: number }) {
  return (
    <div className="relative w-full flex items-center justify-center">
      <img
        src={`/warplets/warplet-${fid}.png`}
        alt={`Warplet #${fid}`}
        className="rounded-xl"
        draggable={false}
      />
    </div>
  );
}
