"use client";

import LegacyAuctionToolsPanel from "@/components/LegacyAuctionToolsPanel";

export default function LegacyAuctionPreview() {
  return (
    <main className="min-h-screen bg-base-100 px-4 py-6 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-lg border border-base-content/10 bg-base-200/80 p-4 shadow-xl backdrop-blur-md sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
            WarpletGobbler legacy controls
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">
            Legacy AuctionSell
          </h1>
          <p className="mt-2 break-all text-xs text-base-content/60">
            Old AuctionSell: 0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9
          </p>
        </header>

        <LegacyAuctionToolsPanel />
      </div>
    </main>
  );
}
