import { type Address } from "viem";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;
const isAddressLike = (value?: string): value is Address =>
  !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
const envAddress = (value?: string): Address =>
  isAddressLike(value) ? value : ZERO_ADDRESS;
const envBlock = (value?: string): bigint =>
  value != null && /^\d+$/.test(value) ? BigInt(value) : 0n;

/** Base mainnet migration stack — deploy block 47430889, 2026-06-16. */
const MAINNET_AUCTION_SELL_DEPLOY_BLOCK = 47430889n;

/** Base mainnet `DutchAuctionV2` (Gobbler). */
const MAINNET_DUTCH_AUCTION_V2 =
  "0x3D44b22900A103ACF29dC8e81CDCB6306658F234" as Address;

/** Base mainnet `AuctionSell` — post Phase B cutover. */
const MAINNET_AUCTION_SELL =
  "0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D" as Address;

/** Base mainnet `GobbledWarplets` receipt collection. */
const MAINNET_GOBBLED_WARPLETS =
  "0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2" as Address;

/** Pre-migration Gobbler — FeeHandler stream moved away; pot is empty. */
const LEGACY_DUTCH_AUCTION_V2 =
  "0x6B2A584369B2E81269618921C3b0033581819e39" as Address;

/** Pre-migration `AuctionSell` — bot drain only after Phase B cutover. */
const LEGACY_AUCTION_SELL =
  "0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9" as Address;

/** Pre-migration `GobbledWarplets`. */
const LEGACY_GOBBLED_WARPLETS =
  "0x2159d7AAfA7CC6cBFf49B1ab9BD353c7e0d1d10b" as Address;

function resolveDutchAuctionAddress(): Address {
  const fromEnv = process.env.NEXT_PUBLIC_DUTCH_AUCTION_ADDRESS;
  if (
    isAddressLike(fromEnv) &&
    fromEnv.toLowerCase() !== LEGACY_DUTCH_AUCTION_V2.toLowerCase()
  ) {
    return fromEnv;
  }
  return MAINNET_DUTCH_AUCTION_V2;
}

function resolveAuctionSellAddress(): Address {
  const fromEnv = process.env.NEXT_PUBLIC_AUCTION_SELL_ADDRESS;
  if (
    isAddressLike(fromEnv) &&
    fromEnv.toLowerCase() !== LEGACY_AUCTION_SELL.toLowerCase()
  ) {
    return fromEnv;
  }
  return MAINNET_AUCTION_SELL;
}

function resolveGobbledWarpletsAddress(): Address {
  const fromEnv = process.env.NEXT_PUBLIC_GOBBLED_WARPLETS_ADDRESS;
  if (
    isAddressLike(fromEnv) &&
    fromEnv.toLowerCase() !== LEGACY_GOBBLED_WARPLETS.toLowerCase()
  ) {
    return fromEnv;
  }
  return MAINNET_GOBBLED_WARPLETS;
}

function resolveAuctionSellDeployBlock(): bigint {
  const fromEnv = process.env.NEXT_PUBLIC_AUCTION_SELL_DEPLOY_BLOCK;
  if (fromEnv != null && /^\d+$/.test(fromEnv)) return BigInt(fromEnv);
  return MAINNET_AUCTION_SELL_DEPLOY_BLOCK;
}

// Contract addresses — mainnet defaults are baked in; env overrides for staging/preview.
export const CONTRACTS = {
  feeHandler: envAddress(process.env.NEXT_PUBLIC_FEE_HANDLER_ADDRESS),
  dutchAuction: resolveDutchAuctionAddress(),
  auctionSell: resolveAuctionSellAddress(),
  auctionSellLegacy: envAddress(
    process.env.NEXT_PUBLIC_AUCTION_SELL_LEGACY_ADDRESS,
  ),
  staking: envAddress(process.env.NEXT_PUBLIC_STAKING_ADDRESS),
  stratToken: envAddress(
    process.env.NEXT_PUBLIC_STAKING_TOKEN_ADDRESS ??
      process.env.NEXT_PUBLIC_STRAT_TOKEN_ADDRESS,
  ),
  warpgobbToken: envAddress(process.env.NEXT_PUBLIC_WARPGOBB_TOKEN_ADDRESS),
  wethToken: envAddress(process.env.NEXT_PUBLIC_WETH_TOKEN_ADDRESS),
  uniswapV4StateView: envAddress(
    process.env.NEXT_PUBLIC_UNISWAP_V4_STATE_VIEW_ADDRESS ??
      "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
  ),
  warplets: envAddress(process.env.NEXT_PUBLIC_WARPLETS_ADDRESS), // Warplets NFT collection on Base
  gobbledWarplets: resolveGobbledWarpletsAddress(),
  gobbledWarpletsLegacy: envAddress(
    process.env.NEXT_PUBLIC_GOBBLED_WARPLETS_LEGACY_ADDRESS,
  ),
  usdcToken: envAddress(process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS),
  warpgobbWethPool: envAddress(process.env.NEXT_PUBLIC_WARPGOBB_WETH_POOL_ADDRESS),
  wethUsdcPool: envAddress(process.env.NEXT_PUBLIC_WETH_USDC_POOL_ADDRESS),
} as const;

export const CONTRACT_BLOCKS = {
  // 0 means "unconfigured"; callers that use this as a scan floor must guard
  // against full-chain scans.
  auctionSellDeploy: resolveAuctionSellDeployBlock(),
  auctionSellLegacyDeploy: envBlock(
    process.env.NEXT_PUBLIC_AUCTION_SELL_LEGACY_DEPLOY_BLOCK,
  ),
} as const;

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** `bytes32` pool id for Uniswap v4 StateView.getSlot0 — accepts with or without 0x. */
export function normalizeV4PoolIdBytes32(raw?: string): `0x${string}` {
  if (!raw?.trim()) return ZERO_BYTES32 as `0x${string}`;
  const s = raw.trim();
  if (/^0x[0-9a-fA-F]{64}$/i.test(s)) return s.toLowerCase() as `0x${string}`;
  if (/^[0-9a-fA-F]{64}$/i.test(s))
    return (`0x${s.toLowerCase()}`) as `0x${string}`;
  return ZERO_BYTES32 as `0x${string}`;
}

const v4WarpgobbWethPoolIdRaw =
  process.env.NEXT_PUBLIC_UNISWAP_V4_WARPGOBB_WETH_POOL_ID ??
  process.env.NEXT_PUBLIC_WARPGOBB_WETH_POOL_ID ??
  process.env.NEXT_PUBLIC_WARPGOBB_POOL_KEY;

export const UNISWAP_V4_POOL_IDS = {
  warpgobbWeth: normalizeV4PoolIdBytes32(v4WarpgobbWethPoolIdRaw),
} as const;
