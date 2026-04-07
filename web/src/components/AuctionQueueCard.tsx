"use client";

import {
  QUEUE_BUMP_CROSSFADE_OPACITY_CLASS,
  QUEUE_BUMP_CROSSFADE_TILE_SURFACE_CLASS,
} from "@/lib/queue-bump-crossfade";
import AuctionWarpletImage from "./AuctionWarpletImage";
import { AuctionQueuePlaceBadge } from "./AuctionQueuePlaceBadge";

/** Matches wallet picker tiles (page.tsx) — secondary (purple) ring when selected. */
export default function AuctionQueueCard({
  fid,
  placeInLine,
  isSelected,
  onSelect,
  sourceBumpFadeOut = false,
  sourceBumpEmptyHold = false,
  bumpStripLand = false,
}: {
  fid: number;
  placeInLine: number;
  isSelected: boolean;
  onSelect: () => void;
  /** Phase 1: artwork fades out at the source tile. */
  sourceBumpFadeOut?: boolean;
  /** Phase 2: dashed shell at source; artwork hidden (head preview shows the Warplet). */
  sourceBumpEmptyHold?: boolean;
  /** Phase 3: tile revealed in its new strip position. */
  bumpStripLand?: boolean;
}) {
  const emptyHold = sourceBumpEmptyHold;
  const innerGone = sourceBumpFadeOut || emptyHold;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={sourceBumpFadeOut || emptyHold}
      className={`relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 snap-center rounded-xl overflow-hidden text-center ${QUEUE_BUMP_CROSSFADE_TILE_SURFACE_CLASS} ${
        bumpStripLand ? "animate-queue-bump-strip-land" : ""
      } ${
        emptyHold
          ? "pointer-events-none cursor-default border-2 border-dashed border-base-content/[0.12] bg-base-100/[0.02] shadow-none"
          : "cursor-pointer"
      } ${
        isSelected && !innerGone
          ? "border-2 border-secondary shadow-lg shadow-secondary/30"
          : !emptyHold
            ? "border-2 border-base-content/10 hover:border-base-content/25"
            : ""
      }`}
    >
      <span
        className={`absolute inset-0 ${QUEUE_BUMP_CROSSFADE_OPACITY_CLASS} ${
          innerGone ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden={innerGone}
      >
        {!emptyHold ? <AuctionQueuePlaceBadge place={placeInLine} /> : null}
        <AuctionWarpletImage fid={fid} variant="cover" />
        <span className="pointer-events-none absolute bottom-0 inset-x-0 z-10 text-[10px] py-0.5 bg-black/60 text-base-content/70 text-center tabular-nums">
          #{fid}
        </span>
      </span>
    </button>
  );
}
