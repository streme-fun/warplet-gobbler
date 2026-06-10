import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharePageShell from "@/components/SharePageShell";
import { appUrl } from "@/lib/miniapp-embed";
import { gobbledArtUrl } from "@/lib/og/gobbled-art";
import {
  buildShareMetadata,
  sanitizeRef,
  shareLaunchUrl,
} from "@/lib/share/share-meta";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export const runtime = "nodejs";

type Props = {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
};

const parseWarpletId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 1e9 ? id : null;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const id = parseWarpletId(params.id);
  return buildShareMetadata({
    title: `WARPLET #${id ?? "?"} SURVIVED — WarpletGobbler`,
    description:
      "Swallowed by the Gobbler, auctioned from its gut, claimed by a new keeper. Covered in ooze, but alive.",
    imageUrl: `${appUrl}/api/og/claim/${id ?? 0}`,
    buttonTitle: "🖤 Enter the Gobbler",
    launchUrl: shareLaunchUrl({
      path: "/",
      ref: sanitizeRef(searchParams.ref),
      via: "c",
    }),
  });
}

export default async function ClaimSharePage({ params, searchParams }: Props) {
  const id = parseWarpletId(params.id);
  if (id == null) notFound();

  const ref = sanitizeRef(searchParams.ref);
  const art = await gobbledArtUrl(id);

  return (
    <SharePageShell
      accent="accent"
      kicker="warplet gobbler · receipt claimed"
      headline="It survived."
      imageSrc={art ?? warpletImageSrc(id)}
      imageLabel={`WARPLET #${id}`}
      rows={[
        { label: "Status", value: "rescued from the gut" },
        { label: "Condition", value: "covered in ooze" },
      ]}
      ctaHref={shareLaunchUrl({ path: "/", ref, via: "c" })}
      ctaLabel="Enter the Gobbler"
    />
  );
}
