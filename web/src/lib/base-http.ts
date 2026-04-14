import { http } from "viem";

/**
 * Base JSON-RPC transport for server API routes and the browser.
 * Prefer `BASE_RPC_URL` or `NEXT_PUBLIC_BASE_RPC_URL` so Vercel/serverless
 * chain reads (e.g. `/api/mint-gobbled-nft`) do not rely only on viem’s
 * default public endpoint, which can rate-limit or fail from data centers.
 */
export function baseHttp() {
  const url =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim();
  return url ? http(url) : http();
}
