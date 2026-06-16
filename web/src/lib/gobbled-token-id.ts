/**
 * Pure helpers for resolving the GobbledWarplets receipt id ("gobbled token id")
 * during the claim flow. Token id encoding (see GobbledWarplets.sol):
 *
 *     gobbledTokenId = gobbleIndex * WARPLET_ID_PADDING + warpletId
 *     warpletId      < WARPLET_ID_PADDING   (so decoding is unambiguous)
 *
 * These are split out from the API route so the validation can be unit-tested
 * without any chain reads.
 */

/** Parse an optional client-supplied gobbled token id into a bigint. */
export function parseOptionalGobbledTokenId(raw: unknown): bigint | undefined {
  if (raw == null || raw === "") return undefined;
  // Reject non-primitives up front so e.g. `[5]` (String([5]) === "5") can't
  // slip through the digit check below.
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("Invalid gobbledTokenId");
  }
  if (typeof raw === "number" && !Number.isSafeInteger(raw)) {
    throw new Error("Invalid gobbledTokenId");
  }
  const s = String(raw);
  if (!/^\d+$/.test(s)) {
    throw new Error("Invalid gobbledTokenId");
  }
  return BigInt(s);
}

/**
 * Resolve the receipt id the metadata + signature must line up with.
 *
 * When the client supplies a specific `requestedGobbledTokenId` (from the
 * `AuctionSettled` event), validate it decodes to `warpletId` and points at a
 * reservation that exists, then echo it back. Otherwise fall back to the most
 * recent reservation for the warplet.
 */
export function resolveReceiptTokenId(input: {
  warpletId: bigint;
  padding: bigint;
  gobbleCount: bigint;
  requestedGobbledTokenId?: bigint;
}): bigint {
  const { warpletId, padding, gobbleCount, requestedGobbledTokenId } = input;

  // padding comes from a chain read; a 0 here means a misconfigured/wrong
  // contract, not a bad client request. Throw a distinct (generic-mapped)
  // error instead of letting `% 0n` raise an opaque RangeError.
  if (padding <= 0n) {
    throw new Error("Invalid WARPLET_ID_PADDING from chain");
  }

  if (requestedGobbledTokenId != null) {
    if (requestedGobbledTokenId < 0n) {
      throw new Error("Invalid gobbledTokenId");
    }
    if (requestedGobbledTokenId % padding !== warpletId) {
      throw new Error("gobbledTokenId does not match warpletId");
    }
    if (requestedGobbledTokenId / padding >= gobbleCount) {
      throw new Error(
        "No reservation exists for this gobbledTokenId — has the auction settled?",
      );
    }
    return requestedGobbledTokenId;
  }

  if (gobbleCount === 0n) {
    throw new Error(
      "No reservation exists for this warplet — has the auction settled?",
    );
  }
  return (gobbleCount - 1n) * padding + warpletId;
}
