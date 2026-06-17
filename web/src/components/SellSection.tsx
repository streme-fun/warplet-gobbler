"use client";

import StreamingNumber from "./StreamingNumber";
import { WARPLET_SELLING_DISABLED } from "@/lib/migration";

/* eslint-disable @next/next/no-img-element */

type PickerWarplet = {
  fid: number;
  name: string;
  imageSrc: string;
};

const WARPLET_PICKER_SKELETON_COUNT = 3;

type SellSectionProps = {
  claimBlocking: boolean;
  payoutStream: {
    start: number;
    perSecond: number;
  };
  payoutSymbol?: string;
  isAmountMissing: boolean;
  isPriceLoading?: boolean;
  isDutchAuctionConfigured: boolean;
  fxEstMarketCapUsd: number;
  payoutAmount: number;
  warpgobbPriceUsd: number | null;
  pickerScrollId?: string;
  warpletsConfigured: boolean;
  isConnected: boolean;
  ownedWarpletsError: boolean;
  ownedWarpletsLoading: boolean;
  showWarpletPickerSkeleton: boolean;
  pickerWarplets: PickerWarplet[];
  selectedFid: number | null;
  flyingFid: number | null;
  isSelling: boolean;
  isWriting: boolean;
  sellError: string | null;
  onConnectWallet: () => void;
  onSelectFid: (fid: number | null) => void;
  onSell: () => void;
  registerCardRef: (fid: number, el: HTMLButtonElement | null) => void;
};

export default function SellSection({
  claimBlocking,
  payoutStream,
  payoutSymbol,
  isAmountMissing,
  isPriceLoading = false,
  isDutchAuctionConfigured,
  fxEstMarketCapUsd,
  payoutAmount,
  warpgobbPriceUsd,
  pickerScrollId = "warplet-scroll",
  warpletsConfigured,
  isConnected,
  ownedWarpletsError,
  ownedWarpletsLoading,
  showWarpletPickerSkeleton,
  pickerWarplets,
  selectedFid,
  flyingFid,
  isSelling,
  isWriting,
  sellError,
  onConnectWallet,
  onSelectFid,
  onSell,
  registerCardRef,
}: SellSectionProps) {
  const scrollPickerBy = (delta: number) => {
    const el = document.getElementById(pickerScrollId);
    if (el) el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const buttonDisabled =
    WARPLET_SELLING_DISABLED ||
    !!flyingFid ||
    isSelling ||
    isWriting ||
    (isConnected && !selectedFid);
  const buttonLabel = WARPLET_SELLING_DISABLED
    ? "Selling paused"
    : !isConnected
    ? "Connect Wallet to Sell"
    : ownedWarpletsLoading
      ? "downloading your warplets... "
      : isSelling || isWriting
        ? "Submitting..."
        : selectedFid
          ? `Sell Warplet #${selectedFid}`
          : "Select a Warplet";

  const noOwnedWarplets =
    warpletsConfigured &&
    isConnected &&
    !ownedWarpletsLoading &&
    !ownedWarpletsError &&
    pickerWarplets.length === 0;

  if (claimBlocking) return null;

  return (
    <section
      id="sell-section"
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-2 sm:px-6 pt-16 sm:pt-20 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-8"
    >
      <div className="text-center animate-fade-up-delay-1 mt-8 sm:mt-16">
        <h2 className="text-lg sm:text-2xl tracking-wide">
          Sell Your Warplet to
        </h2>
        <h1 className="font-creepster gobble-title-shadow text-5xl leading-[0.9] sm:text-7xl sm:leading-none font-normal tracking-normal sm:tracking-widest uppercase">
          THE INSATIABLE
          <br />
          <span className="text-primary gobble-title-glow">
            WARPLET GOBBLER
          </span>
        </h1>
      </div>

      <div className="mt-8 sm:mt-14 w-full max-w-4xl animate-fade-up-delay-2 text-center">
        <p className="text-sm sm:text-base text-base-content/50 mb-1">
          The Gobbler will buy your Warplet for...
        </p>
        <div className="text-4xl sm:text-6xl font-mono font-semibold text-primary streaming-glow">
          {isPriceLoading ? (
            <span className="inline-block min-w-[10ch] h-[1.1em] skeleton rounded align-middle" />
          ) : (
            <StreamingNumber
              start={payoutStream.start}
              perSecond={payoutStream.perSecond}
              smartMinSigFigs={6}
              smartHideDecimalsIfIntegerDigitsGt={5}
            />
          )}
          <span className="text-base font-normal text-base-content/40 ml-2">
            {payoutSymbol?.startsWith("$") ? payoutSymbol : `$${payoutSymbol}`}
          </span>
          <p className="text-xs sm:text-sm text-base-content/40 mt-1">
            {isPriceLoading ? (
              "Loading pot…"
            ) : isAmountMissing ? (
              isDutchAuctionConfigured ? (
                <>
                  (~$
                  {fxEstMarketCapUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                  })}
                  )
                </>
              ) : (
                "(~$0.00)"
              )
            ) : payoutAmount > 0 && warpgobbPriceUsd == null ? (
              "USD quote unavailable"
            ) : (
              <>
                (~$
                <StreamingNumber
                  start={payoutStream.start * (warpgobbPriceUsd ?? 0)}
                  perSecond={payoutStream.perSecond * (warpgobbPriceUsd ?? 0)}
                  decimals={2}
                  truncateFractionDigits
                  className="inline font-mono"
                />
                )
              </>
            )}
          </p>
        </div>
        <div className="w-full mt-8 sm:mt-10">
          <div className="relative">
            <button
              onClick={() => scrollPickerBy(-300)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full border border-base-content/15 bg-base-100/80 backdrop-blur-sm flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
              aria-label="Scroll warplets left"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div
              id={pickerScrollId}
              className="overflow-x-auto pb-2 px-20 snap-x snap-mandatory scrollbar-hide"
            >
              {warpletsConfigured && isConnected && ownedWarpletsError && (
                <p className="text-xs text-error/80 px-1 text-center max-w-md mx-auto">
                  Couldn&apos;t load your Warplets right now. Make sure your
                  wallet is connected to Base, then try reconnecting.
                </p>
              )}
              {noOwnedWarplets && (
                <p className="text-xs text-base-content/50 px-1 py-4 text-center">
                  No Warplets in this wallet on Base.
                </p>
              )}
              {showWarpletPickerSkeleton ? (
                <div className="flex min-w-full justify-center">
                  <div className="flex gap-2 w-max">
                    {Array.from(
                      { length: WARPLET_PICKER_SKELETON_COUNT },
                      (_, i) => (
                        <div
                          key={`picker-sk-${i}`}
                          className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border-2 border-base-content/10 snap-center pointer-events-none text-center"
                          aria-hidden
                        >
                          <div className="absolute inset-0 skeleton rounded-none" />
                          <span className="absolute bottom-0 inset-x-0 h-[22px] skeleton rounded-none border-t border-base-content/5" />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : pickerWarplets.length > 0 ? (
                <div className="flex min-w-full justify-center">
                  <div className="flex gap-2 w-max">
                    {pickerWarplets.map((w) => (
                      <button
                        key={w.fid}
                        ref={(el) => registerCardRef(w.fid, el)}
                        onClick={() =>
                          onSelectFid(selectedFid === w.fid ? null : w.fid)
                        }
                        className={`relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border-2 snap-center transition-all duration-200 text-center ${
                          selectedFid === w.fid
                            ? "border-primary shadow-lg shadow-primary/30"
                            : "border-base-content/10 hover:border-base-content/25"
                        } ${flyingFid === w.fid ? "opacity-0" : ""}`}
                      >
                        <img
                          src={w.imageSrc}
                          alt={w.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="absolute bottom-0 inset-x-0 text-[10px] py-0.5 bg-black/60 text-base-content/70 text-center">
                          #{w.fid}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => scrollPickerBy(300)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full border border-base-content/15 bg-base-100/80 backdrop-blur-sm flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
              aria-label="Scroll warplets right"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-8 sm:mt-10 flex justify-center">
          <button
            className={`gobble-btn-ghost ${
              !isConnected
                ? "!font-sans !tracking-normal !text-xs !font-semibold sm:!text-sm"
                : ""
            }`}
            disabled={buttonDisabled}
            onClick={
              WARPLET_SELLING_DISABLED
                ? undefined
                : !isConnected
                  ? onConnectWallet
                  : selectedFid
                    ? onSell
                    : undefined
            }
          >
            {buttonLabel}
          </button>
        </div>

        {WARPLET_SELLING_DISABLED && (
          <p className="mt-2 text-xs text-base-content/50 text-center max-w-md mx-auto">
            Warplet selling is temporarily paused.
          </p>
        )}

        {sellError && (
          <p className="mt-2 text-xs text-error/90 text-center max-w-md mx-auto break-words">
            {sellError}
          </p>
        )}
      </div>
    </section>
  );
}
