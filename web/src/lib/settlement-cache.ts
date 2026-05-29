import type { SettlementRecord } from "@/lib/settlement-records";

/** Bump when the cached shape changes so stale entries are ignored. */
const CACHE_VERSION = 1;
/** Cap persisted/held chain records so storage + merge stay bounded. */
export const SCAN_CACHE_MAX_RECORDS = 100;

export type CachedScan = { lastBlock: bigint; records: SettlementRecord[] };

function cacheKey(chainId: number, address: string): string {
  return `wg:auction-settled-scan:${chainId}:${address.toLowerCase()}`;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isCachedRecord(r: unknown): r is SettlementRecord {
  if (typeof r !== "object" || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.fp === "string" &&
    typeof o.tokenId === "number" &&
    (o.gobbledTokenId === undefined || typeof o.gobbledTokenId === "string") &&
    typeof o.bidder === "string" &&
    typeof o.amountWei === "string" &&
    typeof o.recordedAt === "number"
  );
}

/** Most-recent-N by recordedAt — keeps storage and the in-memory set bounded. */
export function boundScanRecords(
  records: SettlementRecord[],
  max: number = SCAN_CACHE_MAX_RECORDS,
): SettlementRecord[] {
  if (records.length <= max) return records;
  return [...records].sort((a, b) => b.recordedAt - a.recordedAt).slice(0, max);
}

/** Read a previously persisted AuctionSettled scan. Returns null on any miss. */
export function readScanCache(
  chainId: number,
  address: string,
  storage: Storage | null = defaultStorage(),
): CachedScan | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(cacheKey(chainId, address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v?: unknown;
      lastBlock?: unknown;
      records?: unknown;
    };
    if (
      parsed?.v !== CACHE_VERSION ||
      typeof parsed.lastBlock !== "string" ||
      !/^\d+$/.test(parsed.lastBlock) ||
      !Array.isArray(parsed.records)
    ) {
      return null;
    }
    return {
      lastBlock: BigInt(parsed.lastBlock),
      records: parsed.records.filter(isCachedRecord),
    };
  } catch {
    return null;
  }
}

/** Persist the scan result (best-effort; swallows quota/serialization errors). */
export function writeScanCache(
  chainId: number,
  address: string,
  lastBlock: bigint,
  records: SettlementRecord[],
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      cacheKey(chainId, address),
      JSON.stringify({
        v: CACHE_VERSION,
        lastBlock: lastBlock.toString(),
        records: boundScanRecords(records),
      }),
    );
  } catch {
    // best-effort cache — ignore quota / serialization failures
  }
}
