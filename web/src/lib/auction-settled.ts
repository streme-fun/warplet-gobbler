import type { TransactionReceipt } from "viem";
import { isAddressEqual, parseEventLogs } from "viem";
import { auctionSellAbi } from "@/abi/auctionSell";
import {
  getWinnerFingerprint,
  type StoredWinnerHighlight,
} from "@/lib/settlement-records";

/**
 * Pull the exact reserved `gobbledTokenId` out of a settle transaction receipt
 * by matching the `AuctionSettled` log to the settled lot (tokenId + winner +
 * amount). Returns undefined when there is no receipt, no snapshot, or no
 * matching log (the caller then keeps the legacy/fallback id).
 *
 * Note: viem's `parseEventLogs` types `log.args` from the const-asserted ABI,
 * so no casts are needed — a future rename of an `AuctionSettled` field would
 * surface as a type error here rather than a silent miss.
 */
export function auctionSettledGobbledTokenId(
  receipt: TransactionReceipt | null,
  snap: StoredWinnerHighlight | null,
): string | undefined {
  if (!receipt || !snap) return undefined;

  try {
    const logs = parseEventLogs({
      abi: auctionSellAbi,
      eventName: "AuctionSettled",
      logs: receipt.logs,
    });
    const match = logs.find(
      (log) =>
        log.args.tokenId === BigInt(snap.tokenId) &&
        isAddressEqual(log.args.winner, snap.bidder) &&
        log.args.amount === BigInt(snap.amountWei),
    );
    return match?.args.gobbledTokenId.toString();
  } catch {
    return undefined;
  }
}

/**
 * Upgrade a settled-lot snapshot with the exact `gobbledTokenId` (and a
 * receipt-aware fingerprint) when the settle receipt provides one. No-op when
 * the receipt doesn't yield a matching `AuctionSettled` log.
 */
export function attachGobbledTokenId(
  snap: StoredWinnerHighlight | null,
  receipt: TransactionReceipt | null,
): StoredWinnerHighlight | null {
  const gobbledTokenId = auctionSettledGobbledTokenId(receipt, snap);
  if (!snap || gobbledTokenId == null) return snap;

  return {
    ...snap,
    fp: getWinnerFingerprint(
      BigInt(snap.tokenId),
      snap.bidder,
      BigInt(snap.amountWei),
      gobbledTokenId,
    ),
    gobbledTokenId,
  };
}
