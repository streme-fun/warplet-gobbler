const STALE_TOKEN_SYMBOLS = new Set(["LARPBOBB"]);

export function normalizePaymentTokenSymbol(
  symbol: string | undefined,
  fallback = "WARPGOBB",
): string {
  const normalized = symbol?.trim();
  if (!normalized || STALE_TOKEN_SYMBOLS.has(normalized.toUpperCase())) {
    return fallback;
  }
  return normalized;
}

export const PAYMENT_TOKEN_SYMBOL = normalizePaymentTokenSymbol(
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL,
);

export const PAYMENT_TOKEN_LABEL = `$${PAYMENT_TOKEN_SYMBOL}`;

/** Auction / secondary-market bid label — `NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL`, else payment symbol. */
export const AUCTION_BID_TOKEN_SYMBOL = normalizePaymentTokenSymbol(
  process.env.NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL,
  PAYMENT_TOKEN_SYMBOL,
);
