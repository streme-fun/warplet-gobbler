import { ConnectKitButton } from "connectkit";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">WarpletGobbler</h1>
        <p className="text-lg text-gray-400">
          A PunkStrategy-style flywheel for Warplets
        </p>
      </div>

      <ConnectKitButton />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mt-8">
        {/* Dutch Auction — the Gobbler */}
        <div className="border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">The Gobbler</h2>
          <p className="text-sm text-gray-400 mb-4">
            Dutch auction pot filling via Superfluid stream. Deposit a Warplet to drain it.
          </p>
          <div className="text-3xl font-mono">--</div>
          <p className="text-xs text-gray-500 mt-1">USDCx in pot</p>
        </div>

        {/* Auction Sell */}
        <div className="border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Auction</h2>
          <p className="text-sm text-gray-400 mb-4">
            Bid $STRAT to win gobbled Warplets.
          </p>
          <div className="text-3xl font-mono">--</div>
          <p className="text-xs text-gray-500 mt-1">Current high bid</p>
        </div>

        {/* Staking */}
        <div className="border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Stake</h2>
          <p className="text-sm text-gray-400 mb-4">
            Stake $STRAT. Earn $STRAT from auction proceeds.
          </p>
          <div className="text-3xl font-mono">--</div>
          <p className="text-xs text-gray-500 mt-1">$STRAT staked</p>
        </div>
      </div>
    </main>
  );
}
