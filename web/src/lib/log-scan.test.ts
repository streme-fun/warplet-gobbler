import { describe, it, expect } from "vitest";
import {
  allTargetReceiptsMatched,
  computeLogScanWindows,
  computeLogScanWindowsToFloor,
  type LogScanWindow,
} from "./log-scan";

function floorOf(latest: bigint, lookback: bigint): bigint {
  return latest > lookback ? latest - lookback : 0n;
}

/** Assert the windows form a contiguous, disjoint, descending cover of [floor, latest]. */
function assertCover(
  windows: LogScanWindow[],
  latest: bigint,
  floor: bigint,
  chunk: bigint,
) {
  expect(windows.length).toBeGreaterThan(0);
  // newest-first, fully covers the top and bottom of the range
  expect(windows[0].toBlock).toBe(latest);
  expect(windows[windows.length - 1].fromBlock).toBe(floor);

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    expect(w.fromBlock <= w.toBlock).toBe(true); // well-formed
    expect(w.toBlock - w.fromBlock + 1n <= chunk).toBe(true); // ≤ chunk wide
    expect(w.fromBlock >= floor).toBe(true); // never undershoots the floor
    if (i > 0) {
      // contiguous + disjoint + strictly descending
      expect(w.toBlock).toBe(windows[i - 1].fromBlock - 1n);
    }
  }
}

describe("computeLogScanWindows", () => {
  it("rejects invalid arguments", () => {
    expect(() => computeLogScanWindows(-1n, 10n, 10n)).toThrow();
    expect(() => computeLogScanWindows(10n, -1n, 10n)).toThrow();
    expect(() => computeLogScanWindows(10n, 10n, 0n)).toThrow();
    expect(() => computeLogScanWindows(10n, 10n, -5n)).toThrow();
  });

  it("returns a single window when latest === floor", () => {
    const windows = computeLogScanWindows(0n, 1_000_000n, 10_000n);
    expect(windows).toEqual([{ fromBlock: 0n, toBlock: 0n }]);
  });

  it("clamps the floor to 0 when lookback exceeds latest", () => {
    const latest = 5n;
    const lookback = 1_000_000n;
    const windows = computeLogScanWindows(latest, lookback, 10_000n);
    expect(windows).toEqual([{ fromBlock: 0n, toBlock: 5n }]);
    assertCover(windows, latest, floorOf(latest, lookback), 10_000n);
  });

  it("collapses to one window when chunk is wider than the range", () => {
    const latest = 50n;
    const lookback = 1_000_000n;
    const windows = computeLogScanWindows(latest, lookback, 10_000n);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ fromBlock: 0n, toBlock: 50n });
  });

  it("splits a range into ≤chunk descending windows (exact multiple)", () => {
    const latest = 20_000n;
    const lookback = 20_000n;
    const chunk = 10_000n;
    const windows = computeLogScanWindows(latest, lookback, chunk);
    assertCover(windows, latest, floorOf(latest, lookback), chunk);
    // top windows are exactly `chunk` wide
    expect(windows[0]).toEqual({ fromBlock: 10_001n, toBlock: 20_000n });
    expect(windows[1]).toEqual({ fromBlock: 1n, toBlock: 10_000n });
  });

  it("splits a non-aligned range with a smaller final (oldest) window", () => {
    const latest = 25_000n;
    const lookback = 25_000n;
    const chunk = 10_000n;
    const windows = computeLogScanWindows(latest, lookback, chunk);
    assertCover(windows, latest, floorOf(latest, lookback), chunk);
    expect(windows[0]).toEqual({ fromBlock: 15_001n, toBlock: 25_000n });
    expect(windows.at(-1)?.fromBlock).toBe(0n);
  });

  it("covers the production parameters without gaps and stays finite", () => {
    const latest = 34_000_000n; // realistic Base height
    const lookback = 1_000_000n;
    const chunk = 10_000n;
    const windows = computeLogScanWindows(latest, lookback, chunk);
    assertCover(windows, latest, floorOf(latest, lookback), chunk);
    // 1,000,001 blocks / 10k ≈ 101 windows — bounded, not runaway
    expect(windows.length).toBeLessThanOrEqual(102);
  });
});

describe("computeLogScanWindowsToFloor", () => {
  it("rejects invalid arguments", () => {
    expect(() => computeLogScanWindowsToFloor(-1n, 0n, 10n)).toThrow();
    expect(() => computeLogScanWindowsToFloor(10n, -1n, 10n)).toThrow();
    expect(() => computeLogScanWindowsToFloor(10n, 0n, 0n)).toThrow();
  });

  it("floors at the deploy block and never undershoots it", () => {
    const latest = 46_700_000n;
    const deployBlock = 43_000_000n;
    const chunk = 100_000n;
    const windows = computeLogScanWindowsToFloor(latest, deployBlock, chunk);

    assertCover(windows, latest, deployBlock, chunk);
    expect(windows.at(-1)?.fromBlock).toBe(deployBlock);
  });

  it("reaches old in-set wins beyond the previous fixed lookback", () => {
    const latest = 46_679_379n;
    const oldSettlement = 44_731_673n;
    const oldLookbackFloor = latest - 1_000_000n;

    expect(oldSettlement < oldLookbackFloor).toBe(true);
    const windows = computeLogScanWindowsToFloor(
      latest,
      43_000_000n,
      100_000n,
    );

    expect(
      windows.some(
        (window) =>
          window.fromBlock <= oldSettlement && oldSettlement <= window.toBlock,
      ),
    ).toBe(true);
  });

  it("returns no windows when the deploy floor is above latest", () => {
    expect(computeLogScanWindowsToFloor(10n, 11n, 5n)).toEqual([]);
  });
});

describe("allTargetReceiptsMatched", () => {
  it("returns true only when every target receipt is matched", () => {
    expect(allTargetReceiptsMatched(["901147", "100884860"], ["901147"])).toBe(
      false,
    );
    expect(
      allTargetReceiptsMatched(["901147", "100884860"], [
        "100884860",
        "901147",
      ]),
    ).toBe(true);
  });

  it("keys on gobbledTokenId so re-gobbled Warplets need the exact receipt", () => {
    expect(allTargetReceiptsMatched(["100884860"], ["884860"])).toBe(false);
    expect(allTargetReceiptsMatched(["100884860"], ["100884860"])).toBe(true);
  });

  it("supports a set of matched ids for incremental resolver state", () => {
    expect(
      allTargetReceiptsMatched([901_147n], new Set(["901147"])),
    ).toBe(true);
  });
});
