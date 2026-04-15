"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { ethMainnetHttp } from "@/lib/eth-mainnet-http";
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
/**
 * Default: Superfluid-hosted Base RPC (override with `NEXT_PUBLIC_BASE_RPC_URL`).
 * The `app=` query value is a public client-side routing / quota label for that
 * endpoint, not a secret; it ships in the bundle like any public RPC URL.
 */
const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6";

/**
 * One config everywhere: iframe heuristic must not swap connector sets or wagmi/ConnectKit disagree.
 *
 * Mainnet is included ONLY so ConnectKit's `<Avatar>` component finds chain 1 in the app's
 * config and uses our CORS-friendly transport instead of falling back to its hardcoded
 * `createConfig({ chains: [mainnet], transports: { [mainnet.id]: http() } })` in
 * `connectkit/build/index.es.js` — that fallback hits viem's default public endpoint
 * (`eth.merkle.io`) which does not serve `Access-Control-Allow-Origin`.
 */
const config = createConfig(
  getDefaultConfig({
    chains: [base, mainnet],
    transports: {
      [base.id]: http(baseRpcUrl),
      [mainnet.id]: ethMainnetHttp(),
    },
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
