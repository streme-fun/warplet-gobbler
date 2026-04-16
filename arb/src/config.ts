import "dotenv/config";
import { type Address, parseEther } from "viem";
import { base } from "viem/chains";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function envAddress(key: string): Address {
  return requireEnv(key) as Address;
}

function optAddress(key: string, fallback: Address): Address {
  return (process.env[key] as Address | undefined) ?? fallback;
}

// ─── RPC ──────────────────────────────────────────────────────────────
export const BASE_RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
export const BASE_PRIVATE_RPC_URL = process.env.BASE_PRIVATE_RPC_URL;

// ─── Wallet ───────────────────────────────────────────────────────────
export const BOT_PRIVATE_KEY = requireEnv("BOT_PRIVATE_KEY") as `0x${string}`;

// ─── Addresses ────────────────────────────────────────────────────────
export const GOBBLE_SNIPER_ADDRESS = envAddress("GOBBLE_SNIPER_ADDRESS");
export const DUTCH_AUCTION_ADDRESS = envAddress("DUTCH_AUCTION_ADDRESS");
export const WARPLETS_ADDRESS = optAddress(
  "WARPLETS_ADDRESS",
  "0x699727f9e01a822efdcf7333073f0461e5914b4e",
);
export const WARPGOBB_TOKEN_ADDRESS = envAddress("WARPGOBB_TOKEN_ADDRESS");
export const WETH_ADDRESS = optAddress(
  "WETH_ADDRESS",
  "0x4200000000000000000000000000000000000006",
);
export const POOL_MANAGER_ADDRESS = optAddress(
  "POOL_MANAGER_ADDRESS",
  "0x498581ff718922c3f8e6a244956af099b2652b2b",
);
export const SEAPORT_ADDRESS = optAddress(
  "SEAPORT_ADDRESS",
  "0x0000000000000068F116a894984e2DB1123eB395",
);
export const STATE_VIEW_ADDRESS = optAddress(
  "STATE_VIEW_ADDRESS",
  "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
);

// ─── V4 Pool ──────────────────────────────────────────────────────────
export const POOL_FEE = Number(process.env.POOL_FEE ?? "3000");
export const POOL_TICK_SPACING = Number(process.env.POOL_TICK_SPACING ?? "60");
export const POOL_HOOKS: Address = optAddress(
  "POOL_HOOKS",
  "0x0000000000000000000000000000000000000000",
);

// ─── OpenSea ──────────────────────────────────────────────────────────
export const OPENSEA_API_KEY = requireEnv("OPENSEA_API_KEY");
export const WARPLETS_COLLECTION_SLUG =
  process.env.WARPLETS_COLLECTION_SLUG ?? "the-warplets-farcaster";

// ─── Bot parameters ──────────────────────────────────────────────────
export const MIN_PROFIT_WEI = parseEther(process.env.MIN_PROFIT_ETH ?? "0.001");
export const MAX_SPEND_WEI = parseEther(process.env.MAX_SPEND_ETH ?? "0.5");
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_SEC ?? "15") * 1000;
export const SWAP_SLIPPAGE_BPS = BigInt(process.env.SWAP_SLIPPAGE_BPS ?? "300");
// Gas multiplier in bps (10000 = 1x, 12000 = 1.2x). Accept legacy float value via fallback.
export const GAS_BUFFER_BPS = BigInt(
  process.env.GAS_BUFFER_BPS ??
    Math.round(Number(process.env.GAS_BUFFER ?? "1.2") * 10_000).toString(),
);
export const DRY_RUN = process.env.DRY_RUN === "true";

// ─── Chain ────────────────────────────────────────────────────────────
export const CHAIN = base;
