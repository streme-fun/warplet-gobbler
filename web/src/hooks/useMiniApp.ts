"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk, type Context } from "@farcaster/miniapp-sdk";

export function useMiniApp() {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;
        setIsMiniApp(inMiniApp);

        if (!inMiniApp) {
          setIsLoaded(true);
          return;
        }

        const ctx = await sdk.context;
        if (cancelled) return;
        setContext(ctx);
        await sdk.actions.ready();
      } catch (e) {
        console.error("Failed to initialize mini app SDK:", e);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback(() => {
    sdk.actions.close();
  }, []);

  const openUrl = useCallback((url: string) => {
    sdk.actions.openUrl(url);
  }, []);

  return { isLoaded, isMiniApp, context, close, openUrl };
}
