import { http } from "viem";

/**
 * Ethereum L1 JSON-RPC for ENS and other mainnet reads (client + server).
 *
 * Defaults to Cloudflare's public Ethereum endpoint (CORS-enabled, hosted on
 * Cloudflare's edge) so ConnectKit's hardcoded ENS avatar queries don't fall
 * through to viem's default (`eth.merkle.io`), which refuses cross-origin
 * requests from a browser. Set `NEXT_PUBLIC_ETH_RPC_URL` to override for
 * higher-quota / paid providers.
 */
const DEFAULT_ETH_RPC_URL = "https://cloudflare-eth.com";

export function ethMainnetHttp() {
  const url =
    process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim() || DEFAULT_ETH_RPC_URL;
  return http(url);
}
