import { http } from "viem";

/**
 * Ethereum L1 JSON-RPC for ENS and other mainnet reads (client + server).
 * Set `NEXT_PUBLIC_ETH_RPC_URL` to avoid viem’s default public mainnet endpoint.
 */
export function ethMainnetHttp() {
  const url = process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim();
  return url ? http(url) : http();
}
