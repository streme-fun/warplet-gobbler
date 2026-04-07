"use client";

import AuctionWarpletImage from "./AuctionWarpletImage";

/** Head-column preview — dashed ring, purple haze; optional pulse on art. */
export default function AuctionQueueBumpPreviewCard({
  fid,
  pulse = true,
}: {
  fid: number;
  /** When false, art stays static (after source slot has cleared). */
  pulse?: boolean;
}) {
  return (
    <div
      className="relative box-border h-full min-h-[7rem] w-full flex-shrink-0 snap-start pointer-events-none overflow-hidden rounded-xl border-[3px] border-dashed border-secondary/55 shadow-[0_0_40px_-2px_rgba(123,97,255,0.62),0_0_80px_-14px_rgba(123,97,255,0.42)] sm:min-h-[9rem]"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_88%_at_50%_44%,rgba(123,97,255,0.42),rgba(123,97,255,0.12)_55%,transparent_72%)]"
        aria-hidden
      />
      <div
        className={`absolute inset-0 ${pulse ? "animate-queue-bump-preview" : ""}`}
      >
        <AuctionWarpletImage fid={fid} variant="cover" />
      </div>
      <span className="pointer-events-none absolute bottom-0 inset-x-0 z-10 text-[10px] py-0.5 bg-black/60 text-base-content/70 text-center tabular-nums">
        #{fid}
      </span>
    </div>
  );
}
