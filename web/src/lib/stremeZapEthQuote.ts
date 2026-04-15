import type { Address, PublicClient } from "viem";
import { isAddressEqual, parseEther, zeroAddress } from "viem";
import { stremeZapAbi } from "@/abi/stremeZap";

const MAX_ETH = parseEther("500");
const QUOTE_SCALE = 10n ** 18n;
const MIN_SEED_WEI = 10n ** 11n; // 0.0000001 ETH
const MAX_SEED_WEI = parseEther("2");
const MAX_EXPAND_STEPS = 18;
const MAX_REFINE_STEPS = 8;
const MAX_RATIO_HINT_ENTRIES = 50;
const quoteRatioHints = new Map<string, bigint>();

type ZapSimParams = {
  zap: Address;
  bidToken: Address;
  bidWei: bigint;
  ethWei: bigint;
  account: Address;
};

async function simulateZapAmountOut(
  client: PublicClient,
  p: ZapSimParams,
): Promise<bigint | null> {
  try {
    const { result } = await client.simulateContract({
      address: p.zap,
      abi: stremeZapAbi,
      functionName: "zap",
      args: [p.bidToken, p.ethWei, p.bidWei, zeroAddress],
      value: p.ethWei,
      account: p.account,
    });
    return result as bigint;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[streme-zap-quote] simulateContract failed", {
        zap: p.zap,
        bidToken: p.bidToken,
        bidWei: p.bidWei.toString(),
        ethWei: p.ethWei.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      console.warn("[streme-zap-quote] simulateContract failed");
    }
    return null;
  }
}

async function zapMeetsBid(
  client: PublicClient,
  p: Omit<ZapSimParams, "ethWei"> & { ethWei: bigint },
): Promise<boolean> {
  const out = await simulateZapAmountOut(client, p);
  return out != null && out >= p.bidWei;
}

export async function quoteMinEthForZapBid(
  client: PublicClient,
  account: Address,
  zap: Address,
  bidToken: Address,
  bidWei: bigint,
): Promise<{ minEthWei: bigint; expectedOutWei: bigint } | null> {
  if (isAddressEqual(zap, zeroAddress) || bidWei <= 0n) return null;

  const hintKey = `${zap.toLowerCase()}:${bidToken.toLowerCase()}`;
  const hintRatio = quoteRatioHints.get(hintKey);
  const hintedSeed =
    hintRatio != null
      ? ((bidWei * hintRatio) / QUOTE_SCALE) * 102n / 100n
      : null;

  // Fast first guess: learned ratio if available, otherwise coarse bid-size heuristic.
  let hi =
    hintedSeed != null && hintedSeed > 0n
      ? hintedSeed
      : bidWei / 10n ** 10n;
  if (hi < MIN_SEED_WEI) hi = MIN_SEED_WEI;
  if (hi > MAX_SEED_WEI) hi = MAX_SEED_WEI;
  if (hi > MAX_ETH) hi = MAX_ETH;

  let lo = 0n;
  let okAtHi = await zapMeetsBid(client, {
    zap,
    bidToken,
    bidWei,
    ethWei: hi,
    account,
  });

  // Expand quickly until amountOutMin clears.
  for (let i = 0; !okAtHi && i < MAX_EXPAND_STEPS; i++) {
    lo = hi;
    if (hi >= MAX_ETH) return null;
    const next = hi * 2n;
    hi = next > MAX_ETH ? MAX_ETH : next;
    okAtHi = await zapMeetsBid(client, {
      zap,
      bidToken,
      bidWei,
      ethWei: hi,
      account,
    });
  }
  if (!okAtHi) return null;

  // Bounded refinement (much fewer RPC calls than exact-search).
  for (let i = 0; i < MAX_REFINE_STEPS && lo + 1n < hi; i++) {
    const mid = (lo + hi) / 2n;
    const ok = await zapMeetsBid(client, {
      zap,
      bidToken,
      bidWei,
      ethWei: mid,
      account,
    });
    if (ok) hi = mid;
    else lo = mid;
  }

  const expectedOutWei = await simulateZapAmountOut(client, {
    zap,
    bidToken,
    bidWei,
    ethWei: hi,
    account,
  });
  if (expectedOutWei == null) return null;

  if (bidWei > 0n) {
    if (quoteRatioHints.size >= MAX_RATIO_HINT_ENTRIES) {
      quoteRatioHints.clear();
    }
    quoteRatioHints.set(hintKey, (hi * QUOTE_SCALE) / bidWei);
  }
  return { minEthWei: hi, expectedOutWei };
}

export function applyEthQuoteBuffer(minEthWei: bigint, bufferBps: bigint): bigint {
  if (bufferBps <= 0n) return minEthWei;
  return minEthWei + (minEthWei * bufferBps) / 10_000n;
}
