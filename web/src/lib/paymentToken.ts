export const PAYMENT_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL ?? "WARPGOBB";

export const PAYMENT_TOKEN_LABEL = `$${PAYMENT_TOKEN_SYMBOL}`;

/** Token symbol shown for secondary-market / auction bids (e.g. $STRAT). */
export const AUCTION_BID_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL ?? "STRAT";

