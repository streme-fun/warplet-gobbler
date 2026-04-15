import {
  type Address,
  type PublicClient,
  formatEther,
  formatUnits,
} from "viem";
import { dutchAuctionAbi, erc20Abi, stateViewAbi } from "./abi.js";
import {
  DUTCH_AUCTION_ADDRESS,
  STATE_VIEW_ADDRESS,
  WARPGOBB_TOKEN_ADDRESS,
  WETH_ADDRESS,
  SWAP_SLIPPAGE_BPS,
  GAS_BUFFER,
  MIN_PROFIT_WEI,
  MAX_SPEND_WEI,
} from "./config.js";
import { log } from "./logger.js";
import type { Listing } from "./opensea.js";

// ─── V4 Pool ID (computed from pool key) ──────────────────────────────
// The pool ID is keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
// We read it from env or compute later.
const POOL_ID = process.env.WARPGOBB_WETH_POOL_ID as `0x${string}` | undefined;

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

export async function getGobblePayout(client: PublicClient): Promise<bigint> {
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
  client: PublicClient,
  warpgobbAmountIn: bigint,
): Promise<bigint> {
  if (!POOL_ID) {
    log.warn("No WARPGOBB_WETH_POOL_ID set — cannot estimate swap output");
    return 0n;
  }

  const [sqrtPriceX96] = await client.readContract({
    address: STATE_VIEW_ADDRESS,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [POOL_ID],
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
export async function estimateGasCost(client: PublicClient): Promise<bigint> {
  const gasPrice = await client.getGasPrice();
  // Seaport fulfill ≈ 150k, gobble ≈ 120k, V4 swap ≈ 200k, WETH unwrap ≈ 30k
  // Total ≈ 500k gas. Buffer for safety.
  const estimatedGas = 600_000n;
  const buffered = BigInt(Math.ceil(Number(gasPrice) * GAS_BUFFER));
  return estimatedGas * buffered;
}

// ─── Full opportunity evaluation ──────────────────────────────────────

export async function evaluateOpportunity(
  client: PublicClient,
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
  const netProfit = swapOutput > totalSpent ? swapOutput - totalSpent : -(totalSpent - swapOutput);
  const profitable = swapOutput > totalSpent && swapOutput - totalSpent >= MIN_PROFIT_WEI;

  const result = makeResult(listing, gobblePayout, swapOutput, gasCost, totalSpent, profitable);
  result.netProfit = netProfit;

  log.info("Opportunity evaluated", {
    tokenId: listing.tokenId,
    listingPrice: formatEther(listing.priceWei),
    gobblePayout: formatEther(gobblePayout),
    swapOutput: formatEther(swapOutput),
    gasCost: formatEther(gasCost),
    netProfit: formatEther(netProfit),
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
