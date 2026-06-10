import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import {
  appUrl,
  SELL_EMBED_IMAGE,
  buildMiniappEmbed,
} from "@/lib/miniapp-embed";
import { sanitizeRef } from "@/lib/share/share-meta";

// Per-route Farcaster embed: a shared `/sell` link previews and launches into
// the sell screen. `other` fully overrides the layout default at the
// `fc:miniapp` key. Dynamic so a shared `/sell?ref=<fid>` keeps the sharer's
// referral through the launch.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const ref = sanitizeRef(searchParams.ref);
  const launchUrl = new URL("/sell", appUrl);
  if (ref) launchUrl.searchParams.set("ref", ref);
  return {
    other: {
      "fc:miniapp": JSON.stringify(
        buildMiniappEmbed({
          imageUrl: SELL_EMBED_IMAGE,
          launchUrl: launchUrl.toString(),
          buttonTitle: "🦷 Feed the Gobbler",
        }),
      ),
    },
  };
}

export default function SellPage() {
  return <HomeView initialView="sell" />;
}
