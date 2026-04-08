import type { PublicClient, Address } from "viem";
import { isAddressEqual, parseEther, zeroAddress } from "viem";
import { stremeZapAbi } from "@/abi/stremeZap";

const MAX_ETH = parseEther("500");

export type ZapSimParams = {
  zap: Address;
  bidToken: Address;
  /** Minimum bid token out (auction bid size). */
  bidWei: bigint;
  /** Native ETH input; must match `amountIn` for production zap. */
  ethWei: bigint;
  account: Address;
};

/**
 * `eth_call` simulation of `zap` — same calldata shape as `AuctionSell.bid`’s zap path.
 * Returns `null` if the call reverts (insufficient ETH, liquidity, etc.).
 */
export async function simulateZapAmountOut(
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
  } catch {
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

/**
 * Minimum `msg.value` such that the live zap clears `amountOutMin == bidWei` on the RPC head.
 * Uses binary search over simulated calls (same mechanism wallets use for gas estimation).
 */
export async function quoteMinEthForZapBid(
  client: PublicClient,
  account: Address,
  zap: Address,
  bidToken: Address,
  bidWei: bigint,
): Promise<{ minEthWei: bigint; expectedOutWei: bigint } | null> {
  if (isAddressEqual(zap, zeroAddress) || bidWei <= 0n) return null;

  let lo = 0n;
  let hi = 1n;
  for (let i = 0; i < 128; i++) {
    const ok = await zapMeetsBid(client, {
      zap,
      bidToken,
      bidWei,
      ethWei: hi,
      account,
    });
    if (ok) break;
    lo = hi;
    if (hi > MAX_ETH / 2n) return null;
    const next = hi * 2n;
    hi = next <= hi ? MAX_ETH : next;
  }
  if (
    !(await zapMeetsBid(client, { zap, bidToken, bidWei, ethWei: hi, account }))
  ) {
    return null;
  }

  while (lo + 1n < hi) {
    const mid = (lo + hi) / 2n;
    if (await zapMeetsBid(client, { zap, bidToken, bidWei, ethWei: mid, account }))
      hi = mid;
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

  return { minEthWei: hi, expectedOutWei };
}

export function applyEthQuoteBuffer(minEthWei: bigint, bufferBps: bigint): bigint {
  if (bufferBps <= 0n) return minEthWei;
  return minEthWei + (minEthWei * bufferBps) / 10_000n;
}
