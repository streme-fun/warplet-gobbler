export type AuctionBidPaymentMode = "token" | "eth";

/**
 * Default payment path for a live auction bid:
 * - If native (zap) bidding is not configured → token / `send` only.
 * - If the wallet is disconnected → token (ETH quote/submit need a signer anyway).
 * - If connected and the wallet holds at least the minimum bid in bid tokens → **token** (fewer moving parts).
 * - Otherwise → **ETH** (swap via zap inside `AuctionSell.bid`).
 */
export function defaultAuctionBidPaymentMethod(opts: {
  nativeEthBidConfigured: boolean;
  viewerAddressDefined: boolean;
  bidTokenBalance: bigint | undefined;
  minBidWei: bigint | null;
}): AuctionBidPaymentMode {
  if (!opts.nativeEthBidConfigured) return "token";
  if (!opts.viewerAddressDefined) return "token";
  if (opts.minBidWei == null) return "token";
  const bal = opts.bidTokenBalance ?? 0n;
  if (bal >= opts.minBidWei) return "token";
  return "eth";
}
