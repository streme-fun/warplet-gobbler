export type LogScanWindow = { fromBlock: bigint; toBlock: bigint };

/**
 * Split a `[latest - lookback, latest]` block range into inclusive,
 * non-overlapping windows of at most `chunk` blocks, ordered newest → oldest.
 *
 * Wide single `eth_getLogs` ranges are rejected by capped RPCs, so the caller
 * walks these windows one request at a time. Newest-first means a mid-scan
 * failure still yields the most recent settlements (what the banner + claim
 * flow care about).
 *
 * Properties (covered by tests): windows are contiguous, disjoint, descending,
 * each at most `chunk` wide, the floor is never undershot, and the list is
 * finite (terminates at the floor).
 */
export function computeLogScanWindows(
  latest: bigint,
  lookbackBlocks: bigint,
  chunkBlocks: bigint,
): LogScanWindow[] {
  if (latest < 0n || lookbackBlocks < 0n) {
    throw new Error("computeLogScanWindows: block numbers must be non-negative");
  }
  if (chunkBlocks <= 0n) {
    throw new Error("computeLogScanWindows: chunkBlocks must be positive");
  }

  const floor = latest > lookbackBlocks ? latest - lookbackBlocks : 0n;
  const windows: LogScanWindow[] = [];

  let toBlock = latest;
  while (toBlock >= floor) {
    const fromBlock =
      toBlock >= floor + chunkBlocks ? toBlock - chunkBlocks + 1n : floor;
    windows.push({ fromBlock, toBlock });
    if (fromBlock === floor) break;
    toBlock = fromBlock - 1n;
  }

  return windows;
}

export function computeLogScanWindowsToFloor(
  latest: bigint,
  floorBlock: bigint,
  chunkBlocks: bigint,
): LogScanWindow[] {
  if (latest < 0n || floorBlock < 0n) {
    throw new Error(
      "computeLogScanWindowsToFloor: block numbers must be non-negative",
    );
  }
  if (chunkBlocks <= 0n) {
    throw new Error("computeLogScanWindowsToFloor: chunkBlocks must be positive");
  }
  if (floorBlock > latest) return [];
  return computeLogScanWindows(latest, latest - floorBlock, chunkBlocks);
}

function isReceiptIdArray(
  value: ReadonlySet<string> | readonly (bigint | string)[],
): value is readonly (bigint | string)[] {
  return Array.isArray(value);
}

export function allTargetReceiptsMatched(
  targetReceiptIds: readonly (bigint | string)[],
  matchedReceiptIds: ReadonlySet<string> | readonly (bigint | string)[],
): boolean {
  const matched: { has: (id: string) => boolean } = isReceiptIdArray(
    matchedReceiptIds,
  )
    ? new Set(matchedReceiptIds.map((id) => id.toString()))
    : matchedReceiptIds;
  return targetReceiptIds.every((id) => matched.has(id.toString()));
}
