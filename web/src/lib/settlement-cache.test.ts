import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import {
  boundScanRecords,
  readScanCache,
  writeScanCache,
} from "./settlement-cache";
import type { SettlementRecord } from "./settlement-records";

const ADDR = "0xAuctionAuctionAuctionAuctionAuction0001" as Address;

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

function rec(over: Partial<SettlementRecord> = {}): SettlementRecord {
  return {
    fp: "fp",
    tokenId: 42,
    gobbledTokenId: "200000042",
    bidder: "0x1111111111111111111111111111111111111111" as Address,
    amountWei: "1000",
    recordedAt: 1,
    ...over,
  };
}

describe("readScanCache / writeScanCache", () => {
  it("round-trips lastBlock (bigint) and records", () => {
    const s = fakeStorage();
    const records = [rec({ fp: "a" }), rec({ fp: "b" })];
    writeScanCache(8453, ADDR, 34_000_000n, records, s);

    const out = readScanCache(8453, ADDR, s);
    expect(out?.lastBlock).toBe(34_000_000n);
    expect(out?.records).toHaveLength(2);
    expect(out?.records[0].gobbledTokenId).toBe("200000042");
  });

  it("is keyed by chainId + address (case-insensitive)", () => {
    const s = fakeStorage();
    writeScanCache(8453, ADDR, 10n, [rec()], s);
    expect(readScanCache(8453, ADDR.toLowerCase() as Address, s)?.records).toHaveLength(1);
    expect(readScanCache(1, ADDR, s)).toBeNull(); // different chain
  });

  it("returns null for a missing entry", () => {
    expect(readScanCache(8453, ADDR, fakeStorage())).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    const s = fakeStorage();
    s.setItem("wg:auction-settled-scan:8453:" + ADDR.toLowerCase(), "{not json");
    expect(readScanCache(8453, ADDR, s)).toBeNull();
  });

  it("rejects a cache written under a different version (forward-compat)", () => {
    const s = fakeStorage();
    s.setItem(
      "wg:auction-settled-scan:8453:" + ADDR.toLowerCase(),
      JSON.stringify({ v: 999, lastBlock: "10", records: [] }),
    );
    expect(readScanCache(8453, ADDR, s)).toBeNull();
  });

  it("drops malformed records but keeps valid ones", () => {
    const s = fakeStorage();
    s.setItem(
      "wg:auction-settled-scan:8453:" + ADDR.toLowerCase(),
      JSON.stringify({
        v: 1,
        lastBlock: "10",
        records: [rec({ fp: "ok" }), { fp: "bad", tokenId: "not-a-number" }],
      }),
    );
    const out = readScanCache(8453, ADDR, s);
    expect(out?.records).toHaveLength(1);
    expect(out?.records[0].fp).toBe("ok");
  });

  it("no-ops without throwing when storage is null (SSR)", () => {
    expect(readScanCache(8453, ADDR, null)).toBeNull();
    expect(() => writeScanCache(8453, ADDR, 1n, [rec()], null)).not.toThrow();
  });
});

describe("boundScanRecords", () => {
  it("returns the input unchanged when under the cap", () => {
    const records = [rec({ fp: "a" }), rec({ fp: "b" })];
    expect(boundScanRecords(records, 5)).toBe(records);
  });

  it("keeps the most-recent N by recordedAt when over the cap", () => {
    const records = [
      rec({ fp: "old", recordedAt: 1 }),
      rec({ fp: "new", recordedAt: 100 }),
      rec({ fp: "mid", recordedAt: 50 }),
    ];
    const bounded = boundScanRecords(records, 2);
    expect(bounded.map((r) => r.fp)).toEqual(["new", "mid"]);
  });
});
