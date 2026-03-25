"use client";

import { ConnectKitButton } from "connectkit";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">WarpletGobbler</h1>
        <p className="text-lg text-base-content/60">
          A PunkStrategy-style flywheel for Warplets
        </p>
      </div>

      <ConnectKitButton />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mt-8">
        {/* Dutch Auction — the Gobbler */}
        <div className="card bg-base-200 border border-base-content/20">
          <div className="card-body">
            <h2 className="card-title">The Gobbler</h2>
            <p className="text-sm text-base-content/60">
              Dutch auction pot filling via Superfluid stream. Deposit a Warplet to drain it.
            </p>
            <div className="text-3xl font-mono">--</div>
            <p className="text-xs text-base-content/50">USDCx in pot</p>
          </div>
        </div>

        {/* Auction Sell */}
        <div className="card bg-base-200 border border-base-content/20">
          <div className="card-body">
            <h2 className="card-title">Auction</h2>
            <p className="text-sm text-base-content/60">
              Bid $STRAT to win gobbled Warplets.
            </p>
            <div className="text-3xl font-mono">--</div>
            <p className="text-xs text-base-content/50">Current high bid</p>
          </div>
        </div>

        {/* Staking */}
        <div className="card bg-base-200 border border-base-content/20">
          <div className="card-body">
            <h2 className="card-title">Stake</h2>
            <p className="text-sm text-base-content/60">
              Stake $STRAT. Earn $STRAT from auction proceeds.
            </p>
            <div className="text-3xl font-mono">--</div>
            <p className="text-xs text-base-content/50">$STRAT staked</p>
          </div>
        </div>
      </div>
    </main>
  );
}
