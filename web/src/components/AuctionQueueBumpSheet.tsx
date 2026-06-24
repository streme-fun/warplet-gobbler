"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AuctionQueueBumpPanel from "./AuctionQueueBumpPanel";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/**
 * Viewport-anchored confirm surface for skip-the-line. The queue can grow past
 * the fold (long carousel, or a future multi-row grid), so once a Warplet is
 * picked the bump CTA must follow the viewport rather than sit inline under the
 * tile — otherwise the form renders off-screen and the user never sees it.
 * Bottom sheet on mobile, floating bottom-centered card on >=sm.
 */
export default function AuctionQueueBumpSheet({
  open,
  onClose,
  placeInLine,
  bidSymbol,
  hasQueueSelection,
  alreadyFirst,
  bumpLiveReady,
  bumpDisabled,
  bumpHint,
  onBump,
  isBumping,
}: {
  open: boolean;
  onClose: () => void;
  /** 1-based queue position of the selected Warplet, for the sheet header. */
  placeInLine: number | null;
  bidSymbol: string;
  hasQueueSelection: boolean;
  alreadyFirst: boolean;
  bumpLiveReady: boolean;
  bumpDisabled: boolean;
  bumpHint?: string | null;
  onBump: () => void;
  isBumping: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Slide-in once mounted+open; instant unmount on close (matches HowItWorks).
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the bumping confirm from being dismissed mid-tx; otherwise Escape closes.
  const requestClose = useCallback(() => {
    if (isBumping) return;
    onClose();
  }, [isBumping, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center transition-opacity duration-200 sm:items-end sm:pb-6 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-bump-sheet-title"
        className={`relative w-full max-w-md transform border border-white/12 bg-[#0b0912]/95 text-base-content shadow-2xl shadow-black/60 transition-transform duration-200 ease-out rounded-t-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:px-5 sm:pb-5 ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-secondary/80">
              Skip the line
            </p>
            {placeInLine != null ? (
              <h2
                id="queue-bump-sheet-title"
                className="mt-0.5 text-sm font-medium text-base-content/85"
              >
                {alreadyFirst
                  ? "This Warplet is already at the front"
                  : `Bump the selected Warplet from #${placeInLine} to the front`}
              </h2>
            ) : (
              <h2
                id="queue-bump-sheet-title"
                className="mt-0.5 text-sm font-medium text-base-content/85"
              >
                Confirm your skip
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={isBumping}
            aria-label="Close skip the line"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-white/65 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 disabled:opacity-40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <AuctionQueueBumpPanel
          bidSymbol={bidSymbol}
          hasQueueSelection={hasQueueSelection}
          alreadyFirst={alreadyFirst}
          bumpLiveReady={bumpLiveReady}
          bumpDisabled={bumpDisabled}
          bumpHint={bumpHint}
          onBump={onBump}
          isBumping={isBumping}
        />
      </section>
    </div>,
    document.body,
  );
}
