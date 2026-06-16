import { isAddressEqual, zeroAddress } from "viem";
import { CONTRACTS } from "@/lib/contracts";

/** True when legacy env is configured (queue overlay only). */
export function legacyMigrationConfigured(): boolean {
  return (
    !isAddressEqual(CONTRACTS.auctionSellLegacy, zeroAddress) &&
    !isAddressEqual(CONTRACTS.gobbledWarpletsLegacy, zeroAddress)
  );
}
