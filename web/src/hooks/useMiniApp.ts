"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { sdk, type Context } from "@farcaster/miniapp-sdk";

type MiniAppNotificationDetails =
  Context.MiniAppContext["client"]["notificationDetails"];

function getMiniAppAddErrorName(error: unknown): string | null {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name)
    : null;
}


export function useMiniApp() {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);
  const autoAddAttemptedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const markAdded = ({
      notificationDetails,
    }: {
      notificationDetails?: MiniAppNotificationDetails;
    }) => {
      if (cancelled) return;
      setIsAdded(true);
      setContext((prev) =>
        prev
          ? {
              ...prev,
              client: {
                ...prev.client,
                added: true,
                notificationDetails:
                  notificationDetails ?? prev.client.notificationDetails,
              },
            }
          : prev,
      );
    };

    const markRemoved = () => {
      if (cancelled) return;
      setIsAdded(false);
      setContext((prev) =>
        prev
          ? {
              ...prev,
              client: {
                ...prev.client,
                added: false,
                notificationDetails: undefined,
              },
            }
          : prev,
      );
    };

    const run = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;
        setIsMiniApp(inMiniApp);

        if (!inMiniApp) {
          setIsLoaded(true);
          return;
        }

        sdk.on("miniAppAdded", markAdded);
        sdk.on("miniAppRemoved", markRemoved);

        const ctx = await sdk.context;
        if (cancelled) return;
        setContext(ctx);
        setIsAdded(ctx.client.added);
        await sdk.actions.ready();

        if (!ctx.client.added && !autoAddAttemptedRef.current) {
          autoAddAttemptedRef.current = true;
          try {
            await sdk.actions.addMiniApp();
            markAdded({});
          } catch (e) {
            const errorName = getMiniAppAddErrorName(e);
            if (errorName !== "RejectedByUser") {
              console.error("Failed to auto-add mini app:", e);
            }
          }
        }
      } catch (e) {
        console.error("Failed to initialize mini app SDK:", e);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
      sdk.removeListener("miniAppAdded", markAdded);
      sdk.removeListener("miniAppRemoved", markRemoved);
    };
  }, []);

  const addMiniApp = useCallback(async () => {
    await sdk.actions.addMiniApp();
    setIsAdded(true);
    setContext((prev) =>
      prev
        ? {
            ...prev,
            client: {
              ...prev.client,
              added: true,
            },
          }
        : prev,
    );
  }, []);

  const close = useCallback(() => {
    sdk.actions.close();
  }, []);

  const openUrl = useCallback((url: string) => {
    sdk.actions.openUrl(url);
  }, []);

  return {
    isLoaded,
    isMiniApp,
    isAdded,
    context,
    addMiniApp,
    close,
    openUrl,
  };

}
