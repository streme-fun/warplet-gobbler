#!/usr/bin/env node
/**
 * Enumerate all ERC721Enumerable token IDs for Warplets (or any enumerable collection on Base).
 * All configuration via env — no defaults (exit 1 if anything is missing).
 *
 * Required env:
 *   BASE_RPC_URL
 *   WARPLETS_NFT_ADDRESS
 *   SCAN_LEGACY_MAX_EXCLUSIVE  (decimal string, e.g. 100000)
 *   SCAN_GOBBLED_MAX_EXCLUSIVE (decimal string, e.g. 100000000)
 *   SCAN_MULTICALL_BATCH       (decimal string, e.g. 400)
 *
 * Usage from repo root:
 *   set -a && source contracts/.env && set +a   # or export vars manually
 *   node web/scripts/scan-warplet-token-ids.mjs
 */

import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || String(v).trim() === "") {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

const rpc = requireEnv("BASE_RPC_URL");
const nft = requireEnv("WARPLETS_NFT_ADDRESS").toLowerCase();
const legacyCap = BigInt(requireEnv("SCAN_LEGACY_MAX_EXCLUSIVE"));
const encodeMax = BigInt(requireEnv("SCAN_GOBBLED_MAX_EXCLUSIVE"));
const batchSize = Number(requireEnv("SCAN_MULTICALL_BATCH"));
if (!Number.isFinite(batchSize) || batchSize < 1) {
  console.error("SCAN_MULTICALL_BATCH must be a positive integer");
  process.exit(1);
}

const enumAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
]);

const client = createPublicClient({
  chain: base,
  transport: http(rpc),
});

const supply = await client.readContract({
  address: nft,
  abi: enumAbi,
  functionName: "totalSupply",
});

let minId = 2n ** 256n - 1n;
let maxId = 0n;
let gteLegacy = 0;
let gteEncode = 0;

for (let start = 0; start < Number(supply); start += batchSize) {
  const end = Math.min(start + batchSize, Number(supply));
  const contracts = [];
  for (let i = start; i < end; i++) {
    contracts.push({
      address: nft,
      abi: enumAbi,
      functionName: "tokenByIndex",
      args: [BigInt(i)],
    });
  }
  const results = await client.multicall({ contracts, batchSize: 1024 });

  for (const r of results) {
    if (r.status !== "success") throw new Error(`tokenByIndex failed: ${r.error?.message ?? r}`);
    const id = r.result;
    if (id < minId) minId = id;
    if (id > maxId) maxId = id;
    if (id >= legacyCap) gteLegacy++;
    if (id >= encodeMax) gteEncode++;
  }
}

console.log("Warplets contract:", nft);
console.log("totalSupply:", supply.toString());
console.log("min tokenId:", minId.toString());
console.log("max tokenId:", maxId.toString());
console.log("count id >= SCAN_LEGACY_MAX_EXCLUSIVE:", gteLegacy);
console.log("count id >= SCAN_GOBBLED_MAX_EXCLUSIVE:", gteEncode);
