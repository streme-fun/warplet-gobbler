"use client";

import { useRef } from "react";
import { QUEUE_BUMP_CROSSFADE_OPACITY_CLASS } from "@/lib/queue-bump-crossfade";
import AuctionQueueBumpPreviewCard from "./AuctionQueueBumpPreviewCard";
import AuctionQueueNextSlotPlaceholder from "./AuctionQueueNextSlotPlaceholder";

export type QueueBumpHeadPhase =
  | "idle"
  | "fade_source"
  | "head_preview"
  | "finalize";

/**
 * Head column: next-slot placeholder vs skip preview.
 * - **selectionPreviewFid**: idle-only; pulses after user picks a tile behind the front.
 * - **bumpPreviewFid**: after Skip — stays visible through source fade (no flash), pulse stops once strip slot is empty, then static through scroll; fades on finalize as the tile lands in the strip.
 */
export default function AuctionQueueHeadSlot({
  bumpPhase,
  selectionPreviewFid,
  bumpPreviewFid,
}: {
  bumpPhase: QueueBumpHeadPhase;
  selectionPreviewFid: number | null;
  bumpPreviewFid: number | null;
}) {
  const lastFidRef = useRef<number | null>(null);

  const activeFid: number | null =
    bumpPhase === "fade_source" ||
    bumpPhase === "head_preview" ||
    bumpPhase === "finalize"
      ? bumpPreviewFid
      : selectionPreviewFid;

  if (activeFid != null) lastFidRef.current = activeFid;

  const fidForRender: number | null =
    activeFid ?? (bumpPhase === "finalize" ? lastFidRef.current : null);

  const showPreviewLayer =
    fidForRender != null &&
    ((bumpPhase === "idle" && selectionPreviewFid != null) ||
      bumpPhase === "fade_source" ||
      bumpPhase === "head_preview" ||
      bumpPhase === "finalize");

  /** Pulsing only while idle+selection or while the source strip tile is still fading out. */
  const pulseArt =
    (bumpPhase === "idle" && selectionPreviewFid != null) ||
    bumpPhase === "fade_source";

  const hidePlaceholder =
    (bumpPhase === "idle" && selectionPreviewFid != null) ||
    bumpPhase === "fade_source" ||
    bumpPhase === "head_preview";

  return (
    <div className="relative box-border aspect-square w-full shrink-0">
      <div
        className={`pointer-events-none absolute inset-0 ${QUEUE_BUMP_CROSSFADE_OPACITY_CLASS} ${
          hidePlaceholder ? "opacity-0" : "opacity-100"
        } ${bumpPhase === "finalize" ? "animate-queue-bump-head-empty-enter" : ""}`}
      >
        <AuctionQueueNextSlotPlaceholder />
      </div>
      {showPreviewLayer && fidForRender != null ? (
        <div
          className={`absolute inset-0 ${QUEUE_BUMP_CROSSFADE_OPACITY_CLASS} ${
            bumpPhase === "finalize"
              ? "opacity-0 pointer-events-none"
              : "opacity-100"
          }`}
        >
          <AuctionQueueBumpPreviewCard fid={fidForRender} pulse={pulseArt} />
        </div>
      ) : null}
    </div>
  );
}
