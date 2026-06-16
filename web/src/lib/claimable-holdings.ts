import {
  mergeSettlementRecords,
  type SettlementRecord,
} from "@/lib/settlement-records";

export type ClaimableHolding = {
  warpletId: bigint;
  receiptId: bigint;
};

export type HoldingClaimability =
  | { status: "claimable"; warpletId: bigint; receiptId: bigint }
  | { status: "live-auction"; warpletId: bigint }
  | { status: "never-gobbled"; warpletId: bigint }
  | { status: "rescued"; warpletId: bigint; receiptId: bigint }
  | { status: "unknown-rescue"; warpletId: bigint; receiptId: bigint };

export function latestReceiptId(input: {
  warpletId: bigint;
  gobbleCount: bigint;
  padding: bigint;
}): bigint | null {
  const { warpletId, gobbleCount, padding } = input;
  if (padding <= 0n) {
    throw new Error("latestReceiptId: padding must be positive");
  }
  if (gobbleCount <= 0n) return null;
  return (gobbleCount - 1n) * padding + warpletId;
}

export function classifyHeldWarplet(input: {
  warpletId: bigint;
  gobbleCount: bigint;
  padding: bigint;
  warpletRescued?: boolean;
  liveAuctionTokenId?: bigint | null;
}): HoldingClaimability {
  const {
    warpletId,
    gobbleCount,
    padding,
    warpletRescued,
    liveAuctionTokenId,
  } = input;

  if (liveAuctionTokenId != null && warpletId === liveAuctionTokenId) {
    return { status: "live-auction", warpletId };
  }

  const receiptId = latestReceiptId({ warpletId, gobbleCount, padding });
  if (receiptId == null) return { status: "never-gobbled", warpletId };
  if (warpletRescued == null) {
    return { status: "unknown-rescue", warpletId, receiptId };
  }
  if (warpletRescued) return { status: "rescued", warpletId, receiptId };
  return { status: "claimable", warpletId, receiptId };
}

export function claimableHoldings(
  holdings: readonly HoldingClaimability[],
): ClaimableHolding[] {
  return holdings
    .filter(
      (holding): holding is Extract<HoldingClaimability, { status: "claimable" }> =>
        holding.status === "claimable",
    )
    .map(({ warpletId, receiptId }) => ({ warpletId, receiptId }));
}

export function settlementRecordsForClaimableHoldings(
  holdings: readonly ClaimableHolding[],
  records: readonly SettlementRecord[],
  opts: { freshRecords?: readonly SettlementRecord[] } = {},
): SettlementRecord[] {
  if (records.length === 0) return [];

  const warpletByReceiptId = new Map<string, bigint>(
    holdings.map((h) => [h.receiptId.toString(), h.warpletId]),
  );
  // A just-mined settle receipt is fresher than the 30s holdings reads. Keep
  // exact local rows visible until the authoritative holdings query catches up.
  const freshExactFps = new Set(
    (opts.freshRecords ?? [])
      .filter((r) => r.gobbledTokenId != null)
      .map((r) => r.fp),
  );

  return mergeSettlementRecords(
    records.filter((r) => {
      if (r.gobbledTokenId == null) return false;
      if (freshExactFps.has(r.fp)) return true;
      const warpletId = warpletByReceiptId.get(r.gobbledTokenId);
      return warpletId != null && BigInt(r.tokenId) === warpletId;
    }),
  );
}
