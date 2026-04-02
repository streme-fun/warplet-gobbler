"use client";

/* eslint-disable @next/next/no-img-element */

import { warpletImageSrc } from "@/lib/warplet-image-src";

export default function AuctionWarpletImage({ fid }: { fid: number }) {
  return (
    <div className="group relative w-full max-w-[200px] aspect-square mx-auto rounded-xl border-2 border-transparent hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 hover:rotate-2 transition-all duration-300 overflow-hidden will-change-transform">
      <img
        src={warpletImageSrc(fid)}
        alt={`Warplet #${fid}`}
        className="w-full rounded-[10px] block"
        draggable={false}
      />
      {/* Shine sweep on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
    </div>
  );
}
