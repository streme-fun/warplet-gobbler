"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { warpletImageSrc } from "@/lib/warplet-image-src";

function gobbledImageSrc(fid: number): string {
  return `/api/gobbled-composite-image?tokenId=${encodeURIComponent(String(fid))}`;
}

export type AuctionWarpletImageMode = "split" | "original" | "gobbled";

export default function AuctionWarpletImage({
  fid,
  variant = "default",
  mode = "split",
}: {
  fid: number;
  variant?: "default" | "hero" | "thumb" | "cover";
  mode?: AuctionWarpletImageMode;
}) {
  const src = warpletImageSrc(fid);
  const [gobbledImageFailed, setGobbledImageFailed] = useState(false);

  useEffect(() => {
    setGobbledImageFailed(false);
  }, [fid, mode]);

  if (variant === "cover") {
    return (
      <img
        src={src}
        alt={`Warplet #${fid}`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    );
  }

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

  if (variant === "hero") {
    const showGobbled = mode !== "original" && !gobbledImageFailed;
    const gobbledStyle = {
      clipPath: mode === "split" ? "inset(0 0 0 50%)" : undefined,
    };

    return (
      <div className="group absolute inset-0 overflow-hidden rounded-[inherit] sm:rounded-l-[0.78rem]">
        <img
          src={src}
          alt={`Warplet #${fid}`}
          className="absolute inset-0 size-full object-cover object-center"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
        {showGobbled && (
          <img
            src={gobbledImageSrc(fid)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover object-center"
            style={gobbledStyle}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setGobbledImageFailed(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="group relative w-full max-w-[200px] aspect-square mx-auto rounded-xl border-2 border-transparent hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 hover:rotate-2 transition-all duration-300 overflow-hidden will-change-transform"
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
