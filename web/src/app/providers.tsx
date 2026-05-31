"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { ethMainnetHttp } from "@/lib/eth-mainnet-http";
import { createWalletConnectStorage } from "@/lib/walletconnect-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultWallets,
  type RainbowKitWalletConnectParameters,
} from "@rainbow-me/rainbowkit";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const appName = "WarpletGobbler";
const appDescription =
  "A PunkStrategy-style flywheel for Warplets using Superfluid streaming";
const appUrl =
  (typeof window !== "undefined" && window.location.origin) ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://warpletgobbler.xyz";
const appIcon = `${appUrl}/logo.jpeg`;
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
const chains = [base, mainnet] as const;

const walletConnectParameters = {
  customStoragePrefix: "warplet-gobbler",
  storage: createWalletConnectStorage(),
  metadata: {
    name: appName,
    description: appDescription,
    url: appUrl,
    icons: [appIcon],
  },
} satisfies RainbowKitWalletConnectParameters;

const { connectors: rainbowKitConnectors } = getDefaultWallets({
  appName,
  appDescription,
  appUrl,
  appIcon,
  projectId: walletConnectProjectId,
  walletConnectParameters,
});

/**
 * One config everywhere: iframe heuristic must not swap connector sets or wagmi's
 * wallet UI state can disagree with the available connectors.
 *
 * Mainnet is included so wallet UI ENS/avatar reads use our CORS-friendly transport
 * instead of viem's default public endpoint (`eth.merkle.io`), which does not serve
 * `Access-Control-Allow-Origin`.
 */
const config = createConfig({
  ssr: true,
  chains,
  transports: {
    [base.id]: http(baseRpcUrl),
    [mainnet.id]: ethMainnetHttp(),
  },
  connectors: [farcasterMiniApp(), ...rainbowKitConnectors],
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={base.id}
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#00F5FF",
            accentColorForeground: "#13111C",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
