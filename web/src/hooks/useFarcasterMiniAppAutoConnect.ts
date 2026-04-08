"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

/** Matches `@farcaster/miniapp-wagmi-connector` `createConnector` id. */
const FARCASTER_MINI_APP_CONNECTOR_ID = "farcaster";

/**
 * In a Farcaster mini app the host injects an EIP-1193 provider; we connect the
 * Farcaster wagmi connector once so `useAccount` / contract hooks work without
 * an explicit “Connect wallet” step.
 */
export function useFarcasterMiniAppAutoConnect(enabled: boolean) {
  const { isConnected } = useAccount();
  const { connectAsync, connectors, isPending, error, reset } = useConnect();
  const [autoFailed, setAutoFailed] = useState(false);

  useEffect(() => {
    if (!enabled) setAutoFailed(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isConnected || autoFailed) return;
    const connector = connectors.find(
      (c) => c.id === FARCASTER_MINI_APP_CONNECTOR_ID,
    );
    if (!connector) return;

    let cancelled = false;

    void (async () => {
      try {
        await connectAsync({ connector });
      } catch {
        if (!cancelled) setAutoFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, isConnected, autoFailed, connectors, connectAsync]);

  const retry = useCallback(() => {
    reset();
    setAutoFailed(false);
  }, [reset]);

  return {
    isConnectingWallet: isPending,
    connectError: error,
    autoFailed,
    retry,
  };
}
