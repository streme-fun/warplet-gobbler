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
 * Sell preview image — the live pot OG render. A shared `/sell` link previews
 * the actual pot ("THE POT IS FATTENING" + current balance), which is both
 * sell-themed and self-updating, replacing the old external-asset placeholder.
 */
export const SELL_EMBED_IMAGE = `${appUrl}/api/og/pot`;

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
  buttonTitle = "Launch",
}: {
  imageUrl: string;
  launchUrl: string;
  /** Feed CTA next to the embed image — ≤32 chars per the miniapp spec. */
  buttonTitle?: string;
}): MiniappEmbed {
  return {
    version: "1",
    imageUrl,
    button: {
      title: buttonTitle,
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
