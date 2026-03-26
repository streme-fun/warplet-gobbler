"use client";

import { useRef, useState } from "react";
import AuctionWarpletCanvas, {
  type AuctionCanvasHandle,
} from "./AuctionWarpletCanvas";
import StreamingNumber from "./StreamingNumber";
import type { MockAuction } from "@/lib/mock-data";

export default function AuctionItem({ auction }: { auction: MockAuction }) {
  const canvasRef = useRef<AuctionCanvasHandle | null>(null);
  const [bought, setBought] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        className="w-full cursor-pointer disabled:cursor-default"
        disabled={bought}
        onClick={() => canvasRef.current?.triggerStrike()}
      >
        <AuctionWarpletCanvas
          fid={auction.fid}
          ref={canvasRef}
          onStrikeDone={() => setBought(true)}
        />
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
