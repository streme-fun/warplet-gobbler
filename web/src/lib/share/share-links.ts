import { appUrl } from "@/lib/miniapp-embed";

/**
 * Share-page URL + cast-text builders. Pure and client-safe (no chain reads)
 * so they can be unit-tested and reused from hooks, OG routes, and the agent
 * API alike.
 *
 * Farcaster scrapes embed images once per unique cast URL, so anything whose
 * image must look "live" (the pot) gets a coarse time bucket appended — every
 * new share window mints a fresh URL and therefore a fresh scrape.
 */

export type ShareRef = {
  /** Sharer's Farcaster fid — carried as `?ref=` for referral attribution. */
  ref?: number | null;
};

function withParams(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const url = new URL(path, appUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

const isTxHash = (value: string): boolean => /^0x[0-9a-fA-F]{64}$/.test(value);

/** Throws on malformed hashes so a bad value never becomes a broken cast embed. */
function assertTxHash(txHash: string): string {
  if (!isTxHash(txHash)) throw new Error(`invalid tx hash: ${txHash}`);
  return txHash.toLowerCase();
}

/** Share page for a gobble (pot drain), keyed by the gobble transaction. */
export function gobbleShareUrl(txHash: string, opts: ShareRef = {}): string {
  return withParams(`/g/${assertTxHash(txHash)}`, { ref: opts.ref });
}

/** Share page for an auction win (settle), keyed by the settle transaction. */
export function winShareUrl(txHash: string, opts: ShareRef = {}): string {
  return withParams(`/w/${assertTxHash(txHash)}`, { ref: opts.ref });
}

/** Share page for a claimed (rescued) gobbled Warplet, keyed by Warplet id. */
export function claimShareUrl(warpletId: number, opts: ShareRef = {}): string {
  if (!Number.isInteger(warpletId) || warpletId <= 0) {
    throw new Error(`invalid warplet id: ${warpletId}`);
  }
  return withParams(`/c/${warpletId}`, { ref: opts.ref });
}

/** Ten-minute bucket — new shares re-scrape, repeat shares within it dedupe. */
export function potShareBucket(nowMs = Date.now()): number {
  return Math.floor(nowMs / 600_000);
}

/** Live-pot share page; `t` bucket mints a fresh embed scrape per window. */
export function potShareUrl(opts: ShareRef & { nowMs?: number } = {}): string {
  return withParams("/pot", { ref: opts.ref, t: potShareBucket(opts.nowMs) });
}

/**
 * Compose-intent fallback for contexts without the Mini App SDK (plain web,
 * Telegram, X). Farcaster supports up to two `embeds[]`.
 */
export function composeIntentUrl({
  text,
  embeds = [],
}: {
  text: string;
  embeds?: string[];
}): string {
  const url = new URL("https://farcaster.xyz/~/compose");
  url.searchParams.set("text", text);
  for (const embed of embeds.slice(0, 2)) {
    url.searchParams.append("embeds[]", embed);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Cast copy. One voice: the Gobbler is a creature, sharing is bragging.
// Keep each under ~280 chars so the embed stays the hero of the cast.
// ---------------------------------------------------------------------------

export function gobbleCastText(opts: {
  tokenId: number;
  amountLabel: string;
  symbol: string;
}): string {
  return [
    `I just fed Warplet #${opts.tokenId} to the Gobbler and drained the pot — ${opts.amountLabel} $${opts.symbol}. 🦷`,
    "",
    "The pot is already refilling. Who's next?",
  ].join("\n");
}

export function winCastText(opts: {
  tokenId: number;
  amountLabel: string;
  symbol: string;
}): string {
  return [
    `Pulled Warplet #${opts.tokenId} out of the Gobbler's gut for ${opts.amountLabel} $${opts.symbol}. 🪦`,
    "",
    "Every gobbled Warplet gets auctioned. Watch the next one.",
  ].join("\n");
}

export function claimCastText(opts: { warpletId: number }): string {
  return [
    `Warplet #${opts.warpletId} survived the Gobbler. Covered in ooze, but alive. 🖤`,
    "",
    "Rescued, claimed, and never the same again.",
  ].join("\n");
}

export function bidCastText(opts: {
  tokenId: number;
  amountLabel: string;
  symbol: string;
}): string {
  return [
    `I'm winning gobbled Warplet #${opts.tokenId} for ${opts.amountLabel} $${opts.symbol} at the Gobbler auction.`,
    "",
    "Outbid me if you dare.",
  ].join("\n");
}

export function potCastText(opts: {
  amountLabel: string;
  symbol: string;
}): string {
  return [
    `The Gobbler's pot is at ${opts.amountLabel} $${opts.symbol} and fattening every second. 👀`,
    "",
    "First Warplet in takes it all.",
  ].join("\n");
}
