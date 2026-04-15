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
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(272px,2.4fr)_minmax(17rem,2fr)] sm:items-stretch gap-0 overflow-hidden rounded-[0.82rem] border border-secondary/25 bg-base-100/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="relative flex w-full flex-col bg-gradient-to-br from-base-200/45 to-base-300/25 sm:min-h-0 sm:h-full">
          <div className="relative aspect-square w-full min-h-0 overflow-hidden rounded-none sm:aspect-auto sm:flex-1 sm:rounded-l-[0.78rem]">
            <div className="skeleton absolute inset-0 min-h-0 w-full" />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 max-w-[min(100%,26rem)] flex-col gap-3 border-t border-base-content/10 bg-base-100/20 px-3 py-3 text-center sm:h-full sm:border-l sm:border-t-0 sm:px-3.5 sm:py-3.5 lg:max-w-[28rem]">
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
