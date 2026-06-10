"use client";

import { useCallback, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAddMiniApp } from "@/hooks/useAddMiniApp";
import { useMiniApp } from "@/hooks/useMiniApp";
import { composeIntentUrl } from "@/lib/share/share-links";

export type SharePayload = {
  text: string;
  /** Share-page URLs; Farcaster renders at most two embeds. */
  embeds: string[];
};

/**
 * One share entry point for every brag surface. Inside the Mini App it opens
 * the native composer (and reports whether the cast was actually published);
 * on the open web it falls back to a compose intent in a new tab.
 *
 * After a confirmed in-app share it chains the addMiniApp prompt — someone
 * who just bragged is at peak willingness to turn on pot alerts.
 */
export function useShareCast() {
  const { isMiniApp, context } = useMiniApp();
  const { maybePromptAdd } = useAddMiniApp();
  const [isSharing, setIsSharing] = useState(false);

  const viewerFid = context?.user?.fid ?? null;

  const share = useCallback(
    async ({ text, embeds }: SharePayload): Promise<boolean> => {
      if (isSharing) return false;
      setIsSharing(true);
      try {
        const capped = embeds.slice(0, 2) as [] | [string] | [string, string];
        if (isMiniApp) {
          const result = await sdk.actions.composeCast({
            text,
            embeds: capped,
          });
          const published = result?.cast != null;
          if (published) void maybePromptAdd();
          return published;
        }
        window.open(
          composeIntentUrl({ text, embeds: capped }),
          "_blank",
          "noopener,noreferrer",
        );
        // Intent flow can't observe the final cast — assume intent to share.
        return true;
      } catch {
        return false;
      } finally {
        setIsSharing(false);
      }
    },
    [isMiniApp, isSharing, maybePromptAdd],
  );

  return { share, isSharing, viewerFid, isMiniApp };
}
