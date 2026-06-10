import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import {
  appUrl,
  AUCTION_EMBED_IMAGE,
  buildMiniappEmbed,
} from "@/lib/miniapp-embed";
import { sanitizeRef } from "@/lib/share/share-meta";

// Per-route Farcaster embed: a shared `/buy` link previews and launches into
// the bid/auction screen. `other` fully overrides the layout default at the
// `fc:miniapp` key (Next.js shallow-merges `other` per key). Dynamic so a
// shared `/buy?ref=<fid>` keeps the sharer's referral through the launch.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const ref = sanitizeRef(searchParams.ref);
  const launchUrl = new URL("/buy", appUrl);
  if (ref) launchUrl.searchParams.set("ref", ref);
  return {
    other: {
      "fc:miniapp": JSON.stringify(
        buildMiniappEmbed({
          imageUrl: AUCTION_EMBED_IMAGE,
          launchUrl: launchUrl.toString(),
        }),
      ),
    },
  };
}

export default function BuyPage() {
  return <HomeView initialView="buy" />;
}
