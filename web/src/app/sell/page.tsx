import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import {
  appUrl,
  SELL_EMBED_IMAGE,
  buildMiniappEmbed,
} from "@/lib/miniapp-embed";

// Per-route Farcaster embed: a shared `/sell` link previews and launches into
// the sell screen. `other` fully overrides the layout default at the
// `fc:miniapp` key.
//
// NOTE: SELL_EMBED_IMAGE is currently a placeholder (the auction image) until
// the real sell asset is hosted on the external image service. See the comment
// on SELL_EMBED_IMAGE for the rollout caveat.
export const metadata: Metadata = {
  other: {
    "fc:miniapp": JSON.stringify(
      buildMiniappEmbed({
        imageUrl: SELL_EMBED_IMAGE,
        launchUrl: `${appUrl}/sell`,
      }),
    ),
  },
};

export default function SellPage() {
  return <HomeView initialView="sell" />;
}
