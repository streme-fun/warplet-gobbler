import type { Address } from "viem";

/** Base mainnet `DutchAuctionV2` — migration deploy 2026-06-16 (block 47430889). */
export const MAINNET_DUTCH_AUCTION_V2 =
  "0x3D44b22900A103ACF29dC8e81CDCB6306658F234" as Address;

/** Pre-migration Gobbler — stream repointed; pot drained. */
export const LEGACY_DUTCH_AUCTION_V2 =
  "0x6B2A584369B2E81269618921C3b0033581819e39" as Address;

/** Earlier testnet-era deploy sometimes still in Vercel env. */
export const DEPRECATED_DUTCH_AUCTION_V2 =
  "0xD3598909A51Ac1227D8EFa240A216A61a43c8344" as Address;

const DRAINED_GOBBLER_SET = new Set(
  [LEGACY_DUTCH_AUCTION_V2, DEPRECATED_DUTCH_AUCTION_V2].map((a) =>
    a.toLowerCase(),
  ),
);

/** Always read the live migration Gobbler on mainnet (ignore stale Vercel env). */
export function mainnetDutchAuctionAddress(): Address {
  return MAINNET_DUTCH_AUCTION_V2;
}

export function isDrainedGobblerAddress(address: string): boolean {
  return DRAINED_GOBBLER_SET.has(address.toLowerCase());
}
