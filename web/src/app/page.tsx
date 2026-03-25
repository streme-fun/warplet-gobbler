"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMiniApp } from "@/hooks/useMiniApp";

export default function Home() {
  const { isLoaded, context } = useMiniApp();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">WarpletGobbler</h1>
        <p className="text-lg text-gray-400">
          A PunkStrategy-style flywheel for Warplets
        </p>
        {context?.user && (
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {context.user.displayName ?? `FID ${context.user.fid}`}
          </p>
        )}
      </div>

      {isConnected ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-mono text-gray-400">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <button
            onClick={() => disconnect()}
            className="btn btn-outline btn-sm"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          className="btn btn-primary"
        >
          Connect Wallet
        </button>
      )}

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
