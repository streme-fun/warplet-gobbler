import { fallback, http } from "viem";

/**
 * Ethereum L1 JSON-RPC for ENS and other mainnet reads (client + server).
 *
 * We need a browser-CORS-enabled mainnet RPC specifically so ConnectKit's
 * hardcoded `<Avatar>` ENS queries don't fail preflight. viem's `http()`
 * default (`eth.merkle.io`) refuses cross-origin requests, and Cloudflare's
 * public `cloudflare-eth.com` gateway stopped serving
 * `Access-Control-Allow-Origin` in early 2024 — so neither is a safe default.
 *
 * Instead we build a `fallback` transport across several independent public
 * endpoints that still serve CORS. If one flakes or drops CORS later, viem
 * rolls to the next automatically. Override with `NEXT_PUBLIC_ETH_RPC_URL`
 * to point at a paid / higher-quota provider (Alchemy, Infura, etc.).
 */
const DEFAULT_ETH_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://eth.drpc.org",
];

export function ethMainnetHttp() {
  const url = process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim();
  if (url) return http(url);
  return fallback(DEFAULT_ETH_RPCS.map((u) => http(u)));
}
