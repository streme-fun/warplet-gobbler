/**
 * Canonical base URL for the deployed app. Single-sourced here so the layout
 * default embed and the per-route embeds (`/buy`, `/sell`) can't drift.
 * Falls back to the production domain when `NEXT_PUBLIC_APP_URL` is unset.
 */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://warpletgobbler.xyz";

/** Bid/auction preview image, hosted on the external image service. */
export const AUCTION_EMBED_IMAGE =
  "https://api.warpletgobbler.xyz/api/gobbler/frimg/mini/auction.png";

/**
 * Sell preview image — PLACEHOLDER.
 *
 * The real sell-themed asset is an external dependency: it must be produced and
 * hosted at `…/frimg/mini/sell.png` on the image service. Until it exists we
 * fall back to the auction image so the embed preview never 404s.
 *
 * ROLLOUT CAVEAT: while this points at the auction image, a shared `/sell` link
 * previews with the *bid* image — do not promote `/sell` in marketing until the
 * real asset lands (see the plan's Scope Boundaries → Deferred to Follow-Up Work).
 * TODO: switch to `…/frimg/mini/sell.png` once the asset is hosted.
 */
export const SELL_EMBED_IMAGE = AUCTION_EMBED_IMAGE;

export type MiniappEmbed = {
  version: string;
  imageUrl: string;
  button: {
    title: string;
    action: {
      type: string;
      name: string;
      url: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
};

/**
 * Build the `fc:miniapp` embed object for a route. Each route's `metadata.other`
 * carries the FULL blob (Next.js shallow-merges `other` per key, so the page's
 * `fc:miniapp` value overwrites the layout default wholesale at that key).
 */
export function buildMiniappEmbed({
  imageUrl,
  launchUrl,
}: {
  imageUrl: string;
  launchUrl: string;
}): MiniappEmbed {
  return {
    version: "1",
    imageUrl,
    button: {
      title: "Launch",
      action: {
        type: "launch_miniapp",
        name: "WarpletGobbler",
        url: launchUrl,
        // splashImageUrl intentionally uses the module-level appUrl (site root),
        // not launchUrl's origin: the splash asset lives at /splash.png on the app
        // root regardless of which route (/buy, /sell) launched the embed.
        splashImageUrl: `${appUrl}/splash.png`,
        splashBackgroundColor: "#13111C",
      },
    },
  };
}
