import { isAddressEqual, zeroAddress } from "viem";
import { CONTRACT_BLOCKS, CONTRACTS } from "@/lib/contracts";

/**
 * Warplets still held on legacy `AuctionSell` until Phase C bot drain (2026-06 migration).
 * FIFO: live legacy lot first, then legacy queue tail.
 */
export const LEGACY_MIGRATION_PENDING_QUEUE_IDS: readonly bigint[] = [
  420499n,
  421769n,
  266221n,
  249800n,
];

/** True when legacy env is configured (queue overlay only). */
export function legacyMigrationConfigured(): boolean {
  return (
    !isAddressEqual(CONTRACTS.auctionSellLegacy, zeroAddress) &&
    !isAddressEqual(CONTRACTS.gobbledWarpletsLegacy, zeroAddress)
  );
}

/** Earliest block to scan for `AuctionSettled` when legacy + new auctions are both queried. */
export function settlementScanFloorBlock(): bigint {
  const newDeploy = CONTRACT_BLOCKS.auctionSellDeploy;
  if (!legacyMigrationConfigured()) return newDeploy;
  const legacyDeploy = CONTRACT_BLOCKS.auctionSellLegacyDeploy;
  if (legacyDeploy <= 0n) return newDeploy;
  if (newDeploy <= 0n) return legacyDeploy;
  return legacyDeploy < newDeploy ? legacyDeploy : newDeploy;
}
