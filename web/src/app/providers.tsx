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

/** One config everywhere: iframe heuristic must not swap connector sets or wagmi/ConnectKit disagree. */
const config = createConfig(
  getDefaultConfig({
    chains: [base],
    transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL) },
    walletConnectProjectId,
    appName: "WarpletGobbler",
    connectors: [
      farcasterMiniApp(),
      ...getDefaultConnectors({
        app: { name: "WarpletGobbler" },
        walletConnectProjectId,
        enableAaveAccount: true,
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
