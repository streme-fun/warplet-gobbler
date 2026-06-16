import type { Address } from "viem";

export type SettlementRecord = {
  fp: string;
  /** Warplet/FID id. This stays human-facing and drives source/gobbled artwork. */
  tokenId: number;
  /** Exact GobbledWarplets receipt id reserved by AuctionSell.AuctionSettled. */
  gobbledTokenId?: string;
  bidder: Address;
  amountWei: string;
  recordedAt: number;
};

/** Snapshot shape before persisting (caller adds `recordedAt`). */
export type StoredWinnerHighlight = {
  fp: string;
  tokenId: number;
  gobbledTokenId?: string;
  bidder: Address;
  amountWei: string;
};

/**
 * Stable identity for a settlement. When the exact reserved receipt id is known
 * it's folded in (prefixed `g`) so a record sourced from the on-chain
 * `AuctionSettled` event is distinguishable from a legacy record that only knew
 * the warplet/FID id.
 */
export function getWinnerFingerprint(
  tokenId: bigint,
  bidder: Address,
  amountWei: bigint,
  gobbledTokenId?: bigint | string | null,
): string {
  const id =
    gobbledTokenId == null
      ? tokenId.toString()
      : `g${gobbledTokenId.toString()}`;
  return `${id}-${bidder}-${amountWei}`;
}

/**
 * Identity ignoring the receipt id — used to drop weaker duplicates.
 *
 * Assumption: a `(tokenId, bidder, amountWei)` triple identifies a single lot.
 * If the same warplet were ever re-auctioned to the same bidder at the exact
 * same wei price, two genuinely distinct gobbles would share this key and the
 * legacy record for the earlier one would be dropped. That collision is
 * vanishingly unlikely for a descending-price auction; fold `gobbledTokenId`
 * into the key if that ever stops holding.
 */
function lotKey(r: SettlementRecord): string {
  return `${r.tokenId}-${r.bidder.toLowerCase()}-${r.amountWei}`;
}

/**
 * Collapse settlement records from every source (on-chain log backfill,
 * persisted local history, the live settled lot) into one deduped list.
 *
 * Two passes:
 *  1. A record carrying a `gobbledTokenId` is authoritative for its lot. If any
 *     such record exists for a `(tokenId, bidder, amountWei)` lot, weaker
 *     records for that same lot that lack a `gobbledTokenId` are dropped.
 *  2. Remaining records dedupe by fingerprint, keeping the latest `recordedAt`.
 */
export function mergeSettlementRecords(
  records: SettlementRecord[],
): SettlementRecord[] {
  const exactRecordKeys = new Set(
    records.filter((r) => r.gobbledTokenId != null).map(lotKey),
  );
  const byFp = new Map<string, SettlementRecord>();

  for (const r of records) {
    if (r.gobbledTokenId == null && exactRecordKeys.has(lotKey(r))) {
      continue;
    }

    const prev = byFp.get(r.fp);
    byFp.set(r.fp, {
      ...r,
      recordedAt: prev ? Math.max(prev.recordedAt, r.recordedAt) : r.recordedAt,
    });
  }

  return [...byFp.values()];
}
