"use client";

import { useRef } from "react";
import AuctionWarpletImage from "./AuctionWarpletImage";
import StreamingNumber from "./StreamingNumber";
import type { MockAuction } from "@/lib/mock-data";
import { PAYMENT_TOKEN_LABEL } from "@/lib/paymentToken";

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

  const handleBuy = () => {
    if (bought || !onBuy || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    onBuy(auction.fid, { x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-full">
        <AuctionWarpletImage fid={auction.fid} />
      </div>

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
              min={auction.floor}
            />{" "}
            <span className="text-base-content/40">{PAYMENT_TOKEN_LABEL}</span>
          </>
        )}
      </div>

      {bought ? (
        <span className="text-xs text-base-content/30">Purchased</span>
      ) : (
        <button
          ref={btnRef}
          onClick={handleBuy}
          className="w-3/4 mt-1 py-1.5 rounded-lg border border-secondary/40 text-secondary text-xs sm:text-sm font-medium hover:bg-secondary/10 hover:border-secondary transition-colors"
        >
          Buy
        </button>
      )}
    </div>
  );
}
