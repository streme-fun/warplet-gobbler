import type { SettlementRecord } from "@/lib/settlement-records";

/**
 * The claim UI surfaces winners from a scan of `AuctionSettled` logs plus local
 * history. Those sources never reconcile against on-chain state, so a lot the
 * winner has *already* claimed (its GobbledWarplets receipt pulled out of the
 * auction — `warpletRescued == true`) keeps showing as claimable. Because
 * `claimFocusRecord` focuses the highest-bid open win, an already-claimed
 * higher-bid lot hijacks the focus and hides a genuinely-unclaimed lower-bid
 * lot (and renders a stale CTA that reverts on click).
 *
 * These helpers reconcile records against `warpletRescued`, keyed by the exact
 * reserved receipt id (`gobbledTokenId`).
 */

/** Unique `gobbledTokenId`s (decimal strings) worth a `warpletRescued` read. */
export function gobbledTokenIdsToReconcile(
  records: readonly SettlementRecord[],
): string[] {
  const seen = new Set<string>();
  for (const r of records) {
    if (r.gobbledTokenId != null && r.gobbledTokenId !== "") {
      seen.add(r.gobbledTokenId);
    }
  }
  return [...seen];
}

/**
 * Drop records whose receipt is already rescued on-chain. Records without a
 * known `gobbledTokenId` are kept — we can't reconcile them, and hiding a
 * possibly-unclaimed win is worse than briefly showing a stale one.
 */
export function dropRescuedRecords(
  records: readonly SettlementRecord[],
  rescuedGobbledTokenIds: ReadonlySet<string>,
): SettlementRecord[] {
  if (rescuedGobbledTokenIds.size === 0) return [...records];
  return records.filter(
    (r) =>
      !(r.gobbledTokenId != null && rescuedGobbledTokenIds.has(r.gobbledTokenId)),
  );
}
