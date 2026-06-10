import type { Metadata } from "next";
import { appUrl, buildMiniappEmbed } from "@/lib/miniapp-embed";

/**
 * Metadata for a share page: fc:miniapp embed (Farcaster feeds) plus standard
 * OpenGraph/Twitter cards (everywhere else), all pointing at the same dynamic
 * image. The launch URL carries the sharer's `ref` so new users who arrive
 * through a brag are attributed to the bragger.
 */

/** `ref` must be a plain fid; anything else is dropped, never reflected. */
export function sanitizeRef(ref: string | string[] | undefined): string | null {
  const value = Array.isArray(ref) ? ref[0] : ref;
  return value && /^\d{1,12}$/.test(value) ? value : null;
}

export function shareLaunchUrl(opts: {
  /** App path the embed button opens, e.g. "/" or "/buy". */
  path: string;
  ref: string | null;
  /** Which share surface drove the launch — for attribution analytics. */
  via: string;
}): string {
  const url = new URL(opts.path, appUrl);
  if (opts.ref) url.searchParams.set("ref", opts.ref);
  url.searchParams.set("via", opts.via);
  return url.toString();
}

export function buildShareMetadata(opts: {
  title: string;
  description: string;
  imageUrl: string;
  buttonTitle: string;
  launchUrl: string;
}): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    openGraph: {
      title: opts.title,
      description: opts.description,
      images: [{ url: opts.imageUrl, width: 1200, height: 800 }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [opts.imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(
        buildMiniappEmbed({
          imageUrl: opts.imageUrl,
          launchUrl: opts.launchUrl,
          buttonTitle: opts.buttonTitle,
        }),
      ),
    },
  };
}
