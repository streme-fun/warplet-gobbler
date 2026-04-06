"use client";

/* eslint-disable @next/next/no-img-element */

import { warpletImageSrc } from "@/lib/warplet-image-src";

export default function AuctionWarpletImage({
  fid,
  variant = "default",
}: {
  fid: number;
  variant?: "default" | "hero" | "thumb";
}) {
  const src = warpletImageSrc(fid);

  if (variant === "thumb") {
    return (
      <img
        src={src}
        alt={`Warplet #${fid}`}
        className="w-full h-full object-cover block aspect-square"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const frame =
    variant === "hero"
      ? "border-transparent shadow-none max-w-none hover:border-transparent hover:shadow-none hover:rotate-0"
      : "";

  return (
    <div
      className={`group relative w-full max-w-[200px] aspect-square mx-auto rounded-xl border-2 border-transparent hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 hover:rotate-2 transition-all duration-300 overflow-hidden will-change-transform ${frame}`}
    >
      <img
        src={src}
        alt={`Warplet #${fid}`}
        className="w-full rounded-[10px] block"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      {variant === "default" && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
