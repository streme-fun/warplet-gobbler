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
    <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
      <div className="flex-shrink-0 mx-auto lg:mx-0 w-full max-w-[220px] sm:max-w-[260px] flex flex-col items-center gap-3">
        <div className="skeleton w-full aspect-square rounded-xl shrink-0" />
        <div className="skeleton h-4 w-28 rounded-md" />
        <div className="flex items-center justify-center gap-2 mt-1 w-full">
          <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
          <div className="skeleton w-3 h-3 rounded-sm opacity-50" />
          <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
          <div className="skeleton w-3 h-3 rounded-sm opacity-50" />
          <div className="skeleton w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-4 min-w-0 w-full">
        <div className="w-full flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3 text-left">
            <div className="skeleton h-3 w-44 rounded-md" />
            <div className="skeleton h-3 w-full max-w-md rounded-md" />
            <div className="skeleton h-3 w-full max-w-sm rounded-md opacity-90" />
          </div>
          <div className="shrink-0 space-y-1">
            <div className="skeleton h-8 w-24 sm:w-28 rounded-md ml-auto" />
          </div>
        </div>

        <div className="w-full rounded-xl border border-secondary/25 bg-base-100/20 px-4 py-4 sm:py-5 space-y-4">
          <div className="space-y-2">
            <div className="skeleton h-3 w-20 rounded-md" />
            <div className="skeleton h-9 w-48 sm:w-56 rounded-md max-w-full" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="skeleton h-3 w-24 rounded-md" />
            <div className="skeleton h-11 w-full max-w-md rounded-lg" />
          </div>
        </div>

        <div
          className="w-full rounded-lg border border-base-content/10 bg-base-100/15 px-4 py-3 flex items-center gap-3"
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
  );
}
