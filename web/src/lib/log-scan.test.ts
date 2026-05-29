import { describe, it, expect } from "vitest";
import { computeLogScanWindows, type LogScanWindow } from "./log-scan";

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
