import type { Metadata } from "next";
import SharePageShell from "@/components/SharePageShell";
import { appUrl } from "@/lib/miniapp-embed";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { formatCompactWei } from "@/lib/share/format-amount";
import { resolveShareIdentity } from "@/lib/share/identity";
import {
  lookupSettleByTx,
  readBidTokenMeta,
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
    title: "RESCUED AT AUCTION — WarpletGobbler",
    description:
      "A gobbled Warplet just got pulled out of the Gobbler's gut at auction. The next lot is live.",
    imageUrl: `${appUrl}/api/og/win/${params.tx.toLowerCase()}`,
    buttonTitle: "💜 Bid on the next lot",
    launchUrl: shareLaunchUrl({
      path: "/buy",
      ref: sanitizeRef(searchParams.ref),
      via: "w",
    }),
  });
}

export default async function WinSharePage({ params, searchParams }: Props) {
  const ref = sanitizeRef(searchParams.ref);
  const ctaHref = shareLaunchUrl({ path: "/buy", ref, via: "w" });
  const settle = await lookupSettleByTx(params.tx);

  if (!settle) {
    return (
      <SharePageShell
        accent="secondary"
        kicker="warplet gobbler"
        headline="The auction block"
        imageSrc={null}
        imageLabel={null}
        rows={[]}
        ctaHref={ctaHref}
        ctaLabel="See the live auction"
      />
    );
  }

  const [identity, tokenMeta] = await Promise.all([
    resolveShareIdentity(settle.winner),
    readBidTokenMeta(AUCTION_BID_TOKEN_SYMBOL),
  ]);

  return (
    <SharePageShell
      accent="secondary"
      kicker="warplet gobbler · auction settled"
      headline="Rescued."
      imageSrc={warpletImageSrc(settle.tokenId)}
      imageLabel={`WARPLET #${settle.tokenId}`}
      rows={[
        {
          label: "Winning bid",
          value: `${formatCompactWei(settle.amountWei, tokenMeta.decimals)} $${tokenMeta.symbol}`,
        },
        { label: "Won by", value: identity.displayName },
        { label: "Receipt", value: `Gobbled #${settle.gobbledTokenId}` },
      ]}
      ctaHref={ctaHref}
      ctaLabel="Bid on the next lot"
      txUrl={`https://basescan.org/tx/${settle.txHash}`}
    />
  );
}
