import {
  type PublicClient,
  type Transport,
  formatEther,
} from "viem";
import { dutchAuctionAbi, stateViewAbi } from "./abi.js";

// Structural type that accepts any chain (viem's Chain type is stricter than concrete
// chains like `base`, which include additional tx types like `deposit`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPublicClient = PublicClient<Transport, any>;
import {
  DUTCH_AUCTION_ADDRESS,
  STATE_VIEW_ADDRESS,
  WARPGOBB_TOKEN_ADDRESS,
  WARPGOBB_WETH_POOL_ID,
  WETH_ADDRESS,
  SWAP_SLIPPAGE_BPS,
  GAS_BUFFER_BPS,
  MIN_PROFIT_WEI,
  MAX_SPEND_WEI,
} from "./config.js";
import { log } from "./logger.js";
import type { Listing } from "./opensea.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface Opportunity {
  listing: Listing;
  gobblePayout: bigint;
  estimatedSwapOutput: bigint;
  totalSpent: bigint;
  estimatedGasCost: bigint;
  netProfit: bigint;
  profitable: boolean;
}

// ─── Gobbler payout ───────────────────────────────────────────────────

export async function getGobblePayout(client: AnyPublicClient): Promise<bigint> {
  const payout = await client.readContract({
    address: DUTCH_AUCTION_ADDRESS,
    abi: dutchAuctionAbi,
    functionName: "currentPrice",
  });
  return payout;
}

// ─── V4 pool price estimate ───────────────────────────────────────────

/** Estimate WETH output for a given WARPGOBB input using pool sqrtPriceX96. */
export async function estimateSwapOutput(
  client: AnyPublicClient,
  warpgobbAmountIn: bigint,
): Promise<bigint> {
  const [sqrtPriceX96] = await client.readContract({
    address: STATE_VIEW_ADDRESS,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [WARPGOBB_WETH_POOL_ID],
  });

  if (sqrtPriceX96 === 0n) {
    log.warn("Pool sqrtPriceX96 is zero — pool may not exist");
    return 0n;
  }

  // Determine token order
  const warpgobbIsToken0 =
    WARPGOBB_TOKEN_ADDRESS.toLowerCase() < WETH_ADDRESS.toLowerCase();

  // sqrtPriceX96 = sqrt(token1/token0) * 2^96
  // price = (sqrtPriceX96 / 2^96)^2 = token1 per token0
  const Q96 = 1n << 96n;

  let estimatedOutput: bigint;
  if (warpgobbIsToken0) {
    // Selling token0 (WARPGOBB) for token1 (WETH)
    // output ≈ amountIn * price = amountIn * (sqrtPriceX96)^2 / 2^192
    estimatedOutput = (warpgobbAmountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  } else {
    // Selling token1 (WARPGOBB) for token0 (WETH)
    // output ≈ amountIn / price = amountIn * 2^192 / (sqrtPriceX96)^2
    estimatedOutput =
      (warpgobbAmountIn * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
  }

  // Apply slippage
  estimatedOutput = estimatedOutput * (10_000n - SWAP_SLIPPAGE_BPS) / 10_000n;

  return estimatedOutput;
}

// ─── Gas estimation ───────────────────────────────────────────────────

/** Rough gas cost estimate for the full snipe tx. */
export async function estimateGasCost(client: AnyPublicClient): Promise<bigint> {
  const gasPrice = await client.getGasPrice();
  // Seaport fulfill ≈ 150k, gobble ≈ 120k, V4 swap ≈ 200k, WETH unwrap ≈ 30k
  // Total ≈ 500k gas. Buffer for safety.
  const estimatedGas = 600_000n;
  // Buffer in bps (e.g. 12000 = 1.2x). Stay in bigint for precision.
  const buffered = (gasPrice * GAS_BUFFER_BPS) / 10_000n;
  return estimatedGas * buffered;
}

// ─── Full opportunity evaluation ──────────────────────────────────────

export async function evaluateOpportunity(
  client: AnyPublicClient,
  listing: Listing,
): Promise<Opportunity> {
  // Only handle ETH-denominated listings
  const isEthListing =
    listing.currency.toLowerCase() === "0x0000000000000000000000000000000000000000" ||
    listing.currency.toLowerCase() === WETH_ADDRESS.toLowerCase();

  if (!isEthListing) {
    return makeResult(listing, 0n, 0n, 0n, listing.priceWei, false);
  }

  // Check max spend
  if (listing.priceWei > MAX_SPEND_WEI) {
    log.debug("Listing exceeds MAX_SPEND_ETH", {
      tokenId: listing.tokenId,
      price: formatEther(listing.priceWei),
    });
    return makeResult(listing, 0n, 0n, 0n, listing.priceWei, false);
  }

  // Fetch payout and gas in parallel
  const [gobblePayout, gasCost] = await Promise.all([
    getGobblePayout(client),
    estimateGasCost(client),
  ]);

  if (gobblePayout === 0n) {
    return makeResult(listing, gobblePayout, 0n, gasCost, listing.priceWei, false);
  }

  // Estimate swap output
  const swapOutput = await estimateSwapOutput(client, gobblePayout);

  const totalSpent = listing.priceWei + gasCost;
  // BigInt subtraction handles negative results natively.
  const profitable = swapOutput - totalSpent >= MIN_PROFIT_WEI;

  const result = makeResult(listing, gobblePayout, swapOutput, gasCost, totalSpent, profitable);

  log.info("Opportunity evaluated", {
    tokenId: listing.tokenId,
    listingPrice: formatEther(listing.priceWei),
    gobblePayout: formatEther(gobblePayout),
    swapOutput: formatEther(swapOutput),
    gasCost: formatEther(gasCost),
    netProfit: formatEther(result.netProfit),
    profitable,
  });

  return result;
}

function makeResult(
  listing: Listing,
  gobblePayout: bigint,
  estimatedSwapOutput: bigint,
  estimatedGasCost: bigint,
  totalSpent: bigint,
  profitable: boolean,
): Opportunity {
  return {
    listing,
    gobblePayout,
    estimatedSwapOutput,
    estimatedGasCost,
    totalSpent,
    netProfit: estimatedSwapOutput - totalSpent,
    profitable,
  };
}
