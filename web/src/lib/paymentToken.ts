export const PAYMENT_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL ?? "WARPGOBB";

export const PAYMENT_TOKEN_LABEL = `$${PAYMENT_TOKEN_SYMBOL}`;

/** Auction / secondary-market bid label — `NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL`, else payment symbol. */
export const AUCTION_BID_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL ?? PAYMENT_TOKEN_SYMBOL;

