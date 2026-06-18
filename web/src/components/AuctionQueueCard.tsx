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
  size = "regular",
  sourceBumpFadeOut = false,
  sourceBumpEmptyHold = false,
  bumpStripLand = false,
}: {
  fid: number;
  placeInLine: number;
  isSelected: boolean;
  onSelect: () => void;
  size?: "regular" | "compact";
  /** Phase 1: artwork fades out at the source tile. */
  sourceBumpFadeOut?: boolean;
  /** Phase 2: dashed shell at source; artwork hidden (head preview shows the Warplet). */
  sourceBumpEmptyHold?: boolean;
  /** Phase 3: tile revealed in its new strip position. */
  bumpStripLand?: boolean;
}) {
  const emptyHold = sourceBumpEmptyHold;
  const innerGone = sourceBumpFadeOut || emptyHold;
  const compact = size === "compact";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={sourceBumpFadeOut || emptyHold}
      className={`relative aspect-square w-full flex-shrink-0 overflow-hidden text-center ${
        compact ? "rounded-lg" : "rounded-xl"
      } ${QUEUE_BUMP_CROSSFADE_TILE_SURFACE_CLASS} ${
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
        {!emptyHold ? (
          <AuctionQueuePlaceBadge
            place={placeInLine}
            className={
              compact
                ? placeInLine === 2
                  ? "!left-0.5 !top-0.5 !text-[0.56rem] sm:!text-[0.68rem]"
                  : "!left-0.5 !top-0 !text-[0.9rem] sm:!text-[1rem]"
                : ""
            }
          />
        ) : null}
        <AuctionWarpletImage fid={fid} variant="cover" />
        <span
          className={`pointer-events-none absolute bottom-0 inset-x-0 z-10 bg-black/60 text-center text-base-content/70 tabular-nums ${
            compact ? "py-0 text-[8px]" : "py-0.5 text-[10px]"
          }`}
        >
          #{fid}
        </span>
      </span>
    </button>
  );
}
