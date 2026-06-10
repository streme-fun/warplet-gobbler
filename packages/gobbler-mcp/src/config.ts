import type { Address, Hex } from "viem";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_RE = /^0x[a-fA-F0-9]{64}$/;

/** Warplets NFT collection on Base — stable, so it ships as a default. */
export const DEFAULT_WARPLETS_ADDRESS =
  "0x699727f9e01a822efdcf7333073f0461e5914b4e" as Address;

export const DEFAULT_API_URL = "https://warpletgobbler.xyz";
export const DEFAULT_RPC_URL = "https://mainnet.base.org";

export interface Config {
  /** Base URL of the WarpletGobbler web app (agent API + share embeds). */
  apiUrl: string;
  /** Base mainnet JSON-RPC endpoint. */
  rpcUrl: string;
  /** Optional env overrides; otherwise resolved from the agent API. */
  dutchAuction?: Address;
  auctionSell?: Address;
  warpgobbToken?: Address;
  /**
   * Explicit env override only. Resolution order elsewhere is
   * override > agent API > DEFAULT_WARPLETS_ADDRESS.
   */
  warpletsOverride?: Address;
  /** When set, the send_tx tool is registered and can sign on Base. */
  agentPrivateKey?: Hex;
}

function envAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  if (!ADDRESS_RE.test(value)) {
    throw new Error(`${name} is set but is not a valid 0x address: "${value}"`);
  }
  return value as Address;
}

function envPrivateKey(name: string): Hex | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  if (!PRIVATE_KEY_RE.test(value)) {
    throw new Error(`${name} is set but is not a 0x-prefixed 32-byte hex key`);
  }
  return value as Hex;
}

export function loadConfig(): Config {
  const apiUrl = (process.env.GOBBLER_API_URL ?? DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );
  return {
    apiUrl,
    rpcUrl: process.env.BASE_RPC_URL ?? DEFAULT_RPC_URL,
    dutchAuction: envAddress("DUTCH_AUCTION_ADDRESS"),
    auctionSell: envAddress("AUCTION_SELL_ADDRESS"),
    warpgobbToken: envAddress("WARPGOBB_TOKEN_ADDRESS"),
    warpletsOverride: envAddress("WARPLETS_ADDRESS"),
    agentPrivateKey: envPrivateKey("AGENT_PRIVATE_KEY"),
  };
}
