"use client";

/* eslint-disable @next/next/no-img-element */

export default function AuctionWarpletImage({
  fid,
  variant = "default",
}: {
  fid: number;
  variant?: "default" | "hero" | "thumb";
}) {
  if (variant === "thumb") {
    return (
      <img
        src={`/warplets/warplet-${fid}.png`}
        alt={`Warplet #${fid}`}
        className="w-full h-full object-cover block aspect-square"
        draggable={false}
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
        src={`/warplets/warplet-${fid}.png`}
        alt={`Warplet #${fid}`}
        className="w-full rounded-[10px] block"
        draggable={false}
      />
      {variant === "default" && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
