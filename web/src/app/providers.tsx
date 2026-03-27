"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { isMiniApp } from "@/lib/miniapp";

const config = isMiniApp
  ? createConfig({
      chains: [base],
      transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL) },
      connectors: [farcasterMiniApp()],
    })
  : createConfig(
      getDefaultConfig({
        chains: [base],
        transports: { [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL) },
        walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
        appName: "WarpletGobbler",
      }),
    );

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {isMiniApp ? children : (
          <ConnectKitProvider mode="dark">{children}</ConnectKitProvider>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
