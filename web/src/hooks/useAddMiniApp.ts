"use client";

import { useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@/hooks/useMiniApp";

const PROMPT_AT_KEY = "warpletgobbler:addapp-prompted-at";
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ask the Farcaster client to add (pin + enable notifications for) the app.
 * Adding is the gateway to notification tokens AND a discovery-ranking signal,
 * but the prompt is a modal — so it's only fired right after a dramatic moment
 * (a gobble, a share) and at most once per week per device.
 */
export function useAddMiniApp() {
  const { isMiniApp, context } = useMiniApp();
  const added = context?.client?.added ?? false;

  const maybePromptAdd = useCallback(async (): Promise<boolean> => {
    if (!isMiniApp || added) return false;
    try {
      const last = Number(window.localStorage.getItem(PROMPT_AT_KEY) ?? 0);
      if (Date.now() - last < PROMPT_COOLDOWN_MS) return false;
      window.localStorage.setItem(PROMPT_AT_KEY, String(Date.now()));
    } catch {
      /* storage unavailable — still allow the prompt */
    }
    try {
      await sdk.actions.addMiniApp();
      return true;
    } catch {
      // User declined or the client rejected (e.g. domain mismatch in dev).
      return false;
    }
  }, [isMiniApp, added]);

  return { added, maybePromptAdd };
}
