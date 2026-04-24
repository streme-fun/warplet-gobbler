"use client";

export type AuctionSettlementSkeletonStage =
  | "signing"
  | "confirming"
  | "syncing"
  | null;

export default function AuctionLiveHeroSkeleton({
  stage,
}: {
  stage: AuctionSettlementSkeletonStage;
}) {
  const statusLine =
    stage === "confirming"
      ? "Confirming on Base…"
      : stage === "syncing"
        ? "Syncing the live auction…"
        : "Waiting for wallet…";

  return (
    <div className="auction-warplet-aura rounded-xl">
      <div className="mx-auto grid w-full max-w-96 grid-cols-[minmax(8.75rem,0.9fr)_minmax(0,1fr)] gap-0 overflow-hidden rounded-[0.82rem] border border-secondary/25 bg-base-100/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_18px_48px_-30px_rgba(0,0,0,0.9)] sm:max-w-none sm:grid-cols-[minmax(272px,2.4fr)_minmax(17rem,2fr)] sm:items-stretch sm:bg-base-100/25">
        <div className="relative flex w-full flex-col bg-gradient-to-br from-base-200/45 to-base-300/25 sm:min-h-0 sm:h-full">
          <div className="relative h-full min-h-[10.5rem] w-full overflow-hidden rounded-l-[0.78rem] sm:min-h-0 sm:flex-1">
            <div className="skeleton absolute inset-0 min-h-0 w-full" />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2 border-l border-base-content/10 bg-base-100/35 px-2.5 py-2 text-center sm:h-full sm:max-w-[26rem] sm:gap-3 sm:bg-base-100/20 sm:px-3.5 sm:py-3.5 lg:max-w-[28rem]">
          <div className="shrink-0 space-y-2 border-b border-base-content/10 pb-2">
            <div className="skeleton mx-auto h-7 w-[min(100%,19rem)] rounded-md sm:h-8" />
            <div className="skeleton mx-auto h-3 w-full max-w-md rounded-md" />
            <div className="skeleton mx-auto h-3 w-full max-w-sm rounded-md opacity-90" />
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
            <div className="flex min-h-0 flex-1 flex-col items-center">
              <div className="flex w-full shrink-0 flex-col items-center justify-center gap-2 py-2 sm:py-3 mb-6 sm:mb-10">
                <div className="skeleton mx-auto h-3 w-24 rounded-md" />
                <div className="skeleton mx-auto h-11 w-44 max-w-full rounded-md sm:h-12" />
              </div>
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 py-2 sm:py-3">
                <div className="flex w-full flex-col items-center gap-2">
                  <div className="skeleton mx-auto h-3 w-16 rounded-md" />
                  <div className="skeleton mx-auto h-10 w-48 max-w-full rounded-md sm:h-11" />
                  <div className="skeleton mx-auto h-2.5 w-[4.5rem] rounded-md opacity-80" />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="skeleton h-2.5 w-5 shrink-0 rounded" />
                  <div className="skeleton h-10 w-44 max-w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>

          <div
            className="mt-auto w-full shrink-0 rounded-lg border border-base-content/10 bg-base-100/15 px-4 py-3 text-left flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <span className="loading loading-spinner loading-md text-secondary shrink-0" />
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-secondary/90">
                Finalizing sale
              </p>
              <p className="text-xs text-base-content/55 mt-0.5 leading-snug">
                {statusLine}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
