"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk, type Context } from "@farcaster/miniapp-sdk";

export function useMiniApp() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);

  useEffect(() => {
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

  return { isLoaded, context, sdk, close, openUrl };
}
