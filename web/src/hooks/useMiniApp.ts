"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk, type Context } from "@farcaster/miniapp-sdk";
import { isMiniApp } from "@/lib/miniapp";

export function useMiniApp() {
  const [isLoaded, setIsLoaded] = useState(!isMiniApp);
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);

  useEffect(() => {
    if (!isMiniApp) return;

    const init = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx);
        await sdk.actions.ready();
      } catch (e) {
        console.error("Failed to initialize mini app SDK:", e);
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      init();
    }
  }, [isLoaded]);

  const close = useCallback(() => {
    sdk.actions.close();
  }, []);

  const openUrl = useCallback((url: string) => {
    sdk.actions.openUrl(url);
  }, []);

  return { isLoaded, isMiniApp, context, close, openUrl };
}
