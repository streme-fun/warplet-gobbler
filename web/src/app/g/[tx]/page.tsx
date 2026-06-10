import type { Metadata } from "next";
import SharePageShell from "@/components/SharePageShell";
import { appUrl } from "@/lib/miniapp-embed";
import { PAYMENT_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { formatCompactWei } from "@/lib/share/format-amount";
import { resolveShareIdentity } from "@/lib/share/identity";
import {
  lookupGobbleByTx,
  readPayoutTokenMeta,
} from "@/lib/share/onchain-events";
import {
  buildShareMetadata,
  sanitizeRef,
  shareLaunchUrl,
} from "@/lib/share/share-meta";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export const runtime = "nodejs";

type Props = {
  params: { tx: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  return buildShareMetadata({
    title: "GOBBLED — WarpletGobbler",
    description:
      "A Warplet just got fed to the Gobbler and drained the entire pot. It's already refilling.",
    imageUrl: `${appUrl}/api/og/gobble/${params.tx.toLowerCase()}`,
    buttonTitle: "🦷 Gobble the next pot",
    launchUrl: shareLaunchUrl({
      path: "/sell",
      ref: sanitizeRef(searchParams.ref),
      via: "g",
    }),
  });
}

export default async function GobbleSharePage({ params, searchParams }: Props) {
  const ref = sanitizeRef(searchParams.ref);
  const ctaHref = shareLaunchUrl({ path: "/sell", ref, via: "g" });
  const gobble = await lookupGobbleByTx(params.tx);

  if (!gobble) {
    return (
      <SharePageShell
        accent="primary"
        kicker="warplet gobbler"
        headline="The Gobbler feeds"
        imageSrc={null}
        imageLabel={null}
        rows={[]}
        ctaHref={ctaHref}
        ctaLabel="Watch the pot"
      />
    );
  }

  const [identity, tokenMeta] = await Promise.all([
    resolveShareIdentity(gobble.seller),
    readPayoutTokenMeta(PAYMENT_TOKEN_SYMBOL),
  ]);

  return (
    <SharePageShell
      accent="primary"
      kicker="warplet gobbler · pot drained"
      headline="Gobbled."
      imageSrc={warpletImageSrc(gobble.tokenId)}
      imageLabel={`WARPLET #${gobble.tokenId}`}
      rows={[
        {
          label: "Payout",
          value: `${formatCompactWei(gobble.payoutWei, tokenMeta.decimals)} $${tokenMeta.symbol}`,
        },
        { label: "Fed by", value: identity.displayName },
      ]}
      ctaHref={ctaHref}
      ctaLabel="Gobble the next pot"
      txUrl={`https://basescan.org/tx/${gobble.txHash}`}
    />
  );
}
