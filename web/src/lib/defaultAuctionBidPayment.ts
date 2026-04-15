export type AuctionBidPaymentMode = "token" | "eth";

/**
 * Prefer token bids when possible; otherwise default to ETH zap bids when enabled.
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
  return bal >= opts.minBidWei ? "token" : "eth";
}
