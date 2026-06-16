import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { mergeSettlementScanProgress } from "./settlement-backfill";
import { getWinnerFingerprint, type SettlementRecord } from "./settlement-records";

const ALICE = "0x1111111111111111111111111111111111111111" as Address;
const BOB = "0x2222222222222222222222222222222222222222" as Address;

function rec(over: Partial<SettlementRecord> = {}): SettlementRecord {
  const tokenId = over.tokenId ?? 42;
  const bidder = over.bidder ?? ALICE;
  const amountWei = over.amountWei ?? "1000";
  const gobbledTokenId = over.gobbledTokenId ?? `${tokenId}`;
  return {
    fp: getWinnerFingerprint(
      BigInt(tokenId),
      bidder,
      BigInt(amountWei),
      gobbledTokenId,
    ),
    tokenId,
    gobbledTokenId,
    bidder,
    amountWei,
    recordedAt: 1,
    ...over,
  };
}

describe("mergeSettlementScanProgress", () => {
  it("keeps successful-window records when a later window fails", () => {
    let progress = [rec({ tokenId: 1, recordedAt: 10 })];
    progress = mergeSettlementScanProgress(progress, [
      rec({ tokenId: 2, bidder: BOB, recordedAt: 20 }),
    ]);

    // A later getLogs window throws; callers break without discarding progress.
    expect(progress.map((r) => r.tokenId).sort()).toEqual([1, 2]);
  });

  it("dedupes a completed window against the cache seed", () => {
    const seed = [rec({ tokenId: 1, recordedAt: 10 })];
    const merged = mergeSettlementScanProgress(seed, [
      rec({ tokenId: 1, recordedAt: 50 }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].recordedAt).toBe(50);
  });

  it("keeps a cache seed unchanged when the first window fails before records", () => {
    const seed = [rec({ tokenId: 1, recordedAt: 10 })];

    expect(mergeSettlementScanProgress(seed, [])).toEqual(seed);
  });
});
