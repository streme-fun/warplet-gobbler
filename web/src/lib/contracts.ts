import { type Address } from "viem";
import { mainnetDutchAuctionAddress } from "@/lib/gobbler-mainnet";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;
const isAddressLike = (value?: string): value is Address =>
  !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
const envAddress = (value?: string): Address =>
  isAddressLike(value) ? value : ZERO_ADDRESS;
const envBlock = (value?: string): bigint =>
  value != null && /^\d+$/.test(value) ? BigInt(value) : 0n;

// Contract addresses — set in web/.env.local (env overrides hardcoded mainnet defaults)
export const CONTRACTS = {
  dutchAuction: mainnetDutchAuctionAddress(),
  auctionSell: envAddress(process.env.NEXT_PUBLIC_AUCTION_SELL_ADDRESS),
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
  gobbledWarplets: envAddress(process.env.NEXT_PUBLIC_GOBBLED_WARPLETS_ADDRESS), // Gobbled receipt collection
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
  auctionSellDeploy: envBlock(process.env.NEXT_PUBLIC_AUCTION_SELL_DEPLOY_BLOCK),
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
