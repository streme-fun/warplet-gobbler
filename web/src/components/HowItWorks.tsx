"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AUCTION_BID_TOKEN_SYMBOL,
  PAYMENT_TOKEN_SYMBOL,
} from "@/lib/paymentToken";

function InfoIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

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

function StreamIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8c4.5-4 7.5 4 12 0 1.3-1.1 2.6-1.5 4-1.2" />
      <path d="M4 14c4.5-4 7.5 4 12 0 1.3-1.1 2.6-1.5 4-1.2" />
      <path d="M4 20c4.5-4 7.5 4 12 0 1.3-1.1 2.6-1.5 4-1.2" />
    </svg>
  );
}

function WarpletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 5h10l2 5-7 9-7-9 2-5Z" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M10 14c1.2.9 2.8.9 4 0" />
    </svg>
  );
}

function AuctionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m14 4 6 6" />
      <path d="m12 6 6 6" />
      <path d="m8 10 6 6" />
      <path d="m6 12 6 6" />
      <path d="m7 11 6-6" />
      <path d="m5 19 5-5" />
      <path d="M3 21h8" />
    </svg>
  );
}

function StakeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v18" />
      <path d="M6 8c0-2 2.7-3.5 6-3.5S18 6 18 8s-2.7 3.5-6 3.5S6 10 6 8Z" />
      <path d="M6 8v4c0 2 2.7 3.5 6 3.5s6-1.5 6-3.5V8" />
      <path d="M6 12v4c0 2 2.7 3.5 6 3.5s6-1.5 6-3.5v-4" />
    </svg>
  );
}

const STEPS = [
  {
    title: "Fees become a stream",
    body: `LP fees are collected, swapped into $${PAYMENT_TOKEN_SYMBOL}, and sent into the Gobbler as a live Superfluid stream.`,
    Icon: StreamIcon,
    accent: "text-primary",
  },
  {
    title: "The stream becomes a payout",
    body: `The balance grows every second. Deposit a Warplet to take the live $${PAYMENT_TOKEN_SYMBOL} pot.`,
    Icon: WarpletIcon,
    accent: "text-secondary",
  },
  {
    title: "The Warplet goes back out",
    body: `The gobbled Warplet enters the auction queue. Bidders compete with ${AUCTION_BID_TOKEN_SYMBOL}, and the winner claims the NFT.`,
    Icon: AuctionIcon,
    accent: "text-accent",
  },
  {
    title: "The sale closes the loop",
    body: "Auction proceeds are sent to the configured staking/proceeds recipient, and the next Warplet keeps the loop moving.",
    Icon: StakeIcon,
    accent: "text-success",
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open how WarpletGobbler works"
        title="How it works"
        className="grid h-8 w-8 place-items-center rounded-full border border-base-content/15 text-base-content/65 transition-colors hover:border-primary/50 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:h-9 sm:w-9"
      >
        <InfoIcon className="h-[18px] w-[18px]" />
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-3 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-md sm:px-6"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="how-it-works-title"
                className="relative w-full max-w-2xl overflow-y-auto rounded-lg border border-white/12 bg-[#0b0912]/95 text-base-content shadow-2xl shadow-black/60"
                style={{ maxHeight: "calc(100vh - 2rem)" }}
              >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b0912]/96 px-5 py-4 backdrop-blur sm:px-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/80">
                      How it works
                    </p>
                    <h2
                      id="how-it-works-title"
                      className="font-creepster gobble-title-shadow mt-1 text-3xl font-normal uppercase leading-none tracking-wide text-white sm:text-4xl"
                    >
                      The Gobble Loop
                    </h2>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label="Close how it works"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/65 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                  <p className="max-w-xl text-sm leading-6 text-base-content/78 sm:text-base">
                    A simple machine for turning fees into a live Warplet
                    payout, then routing auction proceeds back through the
                    flywheel.
                  </p>

                  <ol className="mt-5 divide-y divide-white/10 border-y border-white/10">
                    {STEPS.map(({ title, body, Icon, accent }, index) => (
                      <li
                        key={title}
                        className="grid grid-cols-[2.5rem_1fr] gap-3 py-4 sm:grid-cols-[3rem_1fr] sm:gap-4"
                      >
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-full border border-current/35 bg-white/[0.04] ${accent}`}
                          aria-hidden
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] text-base-content/40">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                              {title}
                            </h3>
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-base-content/72">
                            {body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
