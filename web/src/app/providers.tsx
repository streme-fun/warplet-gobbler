"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectKitProvider,
  getDefaultConfig,
  getDefaultConnectors,
} from "connectkit";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

/**
 * Wagmi’s `http` transport uses `fetch` in the browser. The RPC host must reply with
 * CORS headers for your origin. Some providers (e.g. many `eth.merkle.io` setups) do not,
 * which surfaces as a preflight failure in DevTools.
 */
/** Default: Superfluid-hosted Base RPC (override with `NEXT_PUBLIC_BASE_RPC_URL`). All wagmi reads use this URL from the browser, not the wallet’s own node. */
const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6";

/** One config everywhere: iframe heuristic must not swap connector sets or wagmi/ConnectKit disagree. */
const config = createConfig(
  getDefaultConfig({
    chains: [base],
    transports: { [base.id]: http(baseRpcUrl) },
    walletConnectProjectId,
    appName: "WarpletGobbler",
    connectors: [
      farcasterMiniApp(),
      ...getDefaultConnectors({
        app: { name: "WarpletGobbler" },
        walletConnectProjectId,
        // Aave Account is ConnectKit’s optional smart-account connector, not this app’s product.
        enableAaveAccount: false,
      }),
    ],
  }),
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider mode="dark">{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
