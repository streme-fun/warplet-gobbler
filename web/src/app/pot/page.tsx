import type { Metadata } from "next";
import SharePageShell from "@/components/SharePageShell";
import { appUrl } from "@/lib/miniapp-embed";
import { PAYMENT_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { formatCompactWei } from "@/lib/share/format-amount";
import {
  readPayoutTokenMeta,
  readPotWei,
} from "@/lib/share/onchain-events";
import {
  buildShareMetadata,
  sanitizeRef,
  shareLaunchUrl,
} from "@/lib/share/share-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  // `t` (the share-time bucket) busts Farcaster's per-URL scrape cache; pass
  // it through to the image URL so the CDN cache splits the same way.
  const bucket = sanitizeRef(searchParams.t);
  const imageUrl = new URL("/api/og/pot", appUrl);
  if (bucket) imageUrl.searchParams.set("t", bucket);
  return buildShareMetadata({
    title: "THE POT IS FATTENING — WarpletGobbler",
    description:
      "$WARPGOBB is streaming into the Gobbler's pot every second. One Warplet in takes it all.",
    imageUrl: imageUrl.toString(),
    buttonTitle: "👀 Watch the pot grow",
    launchUrl: shareLaunchUrl({
      path: "/sell",
      ref: sanitizeRef(searchParams.ref),
      via: "pot",
    }),
  });
}

export default async function PotSharePage({ searchParams }: Props) {
  const ref = sanitizeRef(searchParams.ref);
  const [potWei, tokenMeta] = await Promise.all([
    readPotWei(),
    readPayoutTokenMeta(PAYMENT_TOKEN_SYMBOL),
  ]);

  return (
    <SharePageShell
      accent="primary"
      kicker="warplet gobbler · live pot"
      headline="The pot is fattening"
      imageSrc={null}
      imageLabel={null}
      rows={[
        {
          label: "Pot right now",
          value:
            potWei != null
              ? `${formatCompactWei(potWei, tokenMeta.decimals)} $${tokenMeta.symbol}`
              : "streaming…",
        },
        { label: "Rule", value: "one Warplet in takes it all" },
      ]}
      ctaHref={shareLaunchUrl({ path: "/sell", ref, via: "pot" })}
      ctaLabel="Watch the pot grow"
    />
  );
}
