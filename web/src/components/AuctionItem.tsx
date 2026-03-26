"use client";

import { useRef } from "react";
import AuctionWarpletCanvas from "./AuctionWarpletCanvas";
import StreamingNumber from "./StreamingNumber";
import type { MockAuction } from "@/lib/mock-data";

export default function AuctionItem({
  auction,
  bought,
  onBuy,
}: {
  auction: MockAuction;
  bought?: boolean;
  onBuy?: (fid: number, rect: { x: number; y: number; w: number; h: number }) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (bought || !onBuy || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    onBuy(auction.fid, { x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        ref={btnRef}
        className="w-full cursor-pointer disabled:cursor-default"
        disabled={bought}
        onClick={handleClick}
      >
        <AuctionWarpletCanvas fid={auction.fid} />
      </button>

      <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full border border-base-content/10 text-base-content/60">
        Warplet #{auction.fid}
      </span>

      <div className="text-[11px] sm:text-sm font-mono text-base-content/80">
        {bought ? (
          <span className="text-success">Sold!</span>
        ) : (
          <>
            <StreamingNumber
              start={auction.priceStart}
              perSecond={auction.priceRate}
              decimals={3}
            />{" "}
            <span className="text-base-content/40">$STRAT</span>
          </>
        )}
      </div>
    </div>
  );
}
