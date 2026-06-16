import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import {
  appUrl,
  AUCTION_EMBED_IMAGE,
  buildMiniappEmbed,
} from "@/lib/miniapp-embed";

// Per-route Farcaster embed: a shared `/buy` link previews and launches into
// the bid/auction screen. `other` fully overrides the layout default at the
// `fc:miniapp` key (Next.js shallow-merges `other` per key).
export const metadata: Metadata = {
  other: {
    "fc:miniapp": JSON.stringify(
      buildMiniappEmbed({
        imageUrl: AUCTION_EMBED_IMAGE,
        launchUrl: `${appUrl}/buy`,
      }),
    ),
  },
};

export default function BuyPage() {
  return <HomeView initialView="buy" />;
}
