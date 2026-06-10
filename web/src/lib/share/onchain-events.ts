import {
  createPublicClient,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { baseHttp } from "@/lib/base-http";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";

/**
 * Server-side lookups behind the share pages and OG images. Everything is
 * keyed by data anyone can verify on Base — a tx hash or token id — so share
 * pages can't be spoofed into bragging about gobbles that never happened.
 */

export const gobbledEventAbi = parseAbi([
  "event Gobbled(address indexed seller, uint256 indexed tokenId, uint256 payout)",
]);

const isTxHash = (value: string): value is Hash =>
  /^0x[0-9a-fA-F]{64}$/.test(value);

const client = createPublicClient({ chain: base, transport: baseHttp() });

export type GobbleEvent = {
  seller: Address;
  tokenId: number;
  payoutWei: bigint;
  txHash: Hash;
};

export type SettleEvent = {
  tokenId: number;
  winner: Address;
  amountWei: bigint;
  gobbledTokenId: string;
  txHash: Hash;
};

/** Module-level TTL cache — receipts are immutable, so long TTL is safe. */
const lookupCache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 10 * 60_000;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = lookupCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  // Only cache positive results: a tx can be "not found" simply because it
  // hasn't propagated to our RPC yet.
  if (value != null) lookupCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Pull the `Gobbled` event out of a gobble transaction. Filters by the
 * configured DutchAuction address when set so a random contract emitting the
 * same signature can't impersonate a gobble.
 */
export async function lookupGobbleByTx(
  txHash: string,
): Promise<GobbleEvent | null> {
  if (!isTxHash(txHash)) return null;
  return cached(`gobble:${txHash.toLowerCase()}`, async () => {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") return null;
      const logs = parseEventLogs({
        abi: gobbledEventAbi,
        eventName: "Gobbled",
        logs: receipt.logs,
      });
      const match = logs.find(
        (log) =>
          CONTRACTS.dutchAuction === ZERO_ADDRESS ||
          log.address.toLowerCase() === CONTRACTS.dutchAuction.toLowerCase(),
      );
      if (!match) return null;
      return {
        seller: match.args.seller,
        tokenId: Number(match.args.tokenId),
        payoutWei: match.args.payout,
        txHash: receipt.transactionHash,
      };
    } catch {
      return null;
    }
  });
}

/** Pull the `AuctionSettled` event out of a settle transaction. */
export async function lookupSettleByTx(
  txHash: string,
): Promise<SettleEvent | null> {
  if (!isTxHash(txHash)) return null;
  return cached(`settle:${txHash.toLowerCase()}`, async () => {
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") return null;
      const logs = parseEventLogs({
        abi: auctionSellAbi,
        eventName: "AuctionSettled",
        logs: receipt.logs,
      });
      const match = logs.find(
        (log) =>
          CONTRACTS.auctionSell === ZERO_ADDRESS ||
          log.address.toLowerCase() === CONTRACTS.auctionSell.toLowerCase(),
      );
      if (!match) return null;
      return {
        tokenId: Number(match.args.tokenId),
        winner: match.args.winner,
        amountWei: match.args.amount,
        gobbledTokenId: match.args.gobbledTokenId.toString(),
        txHash: receipt.transactionHash,
      };
    } catch {
      return null;
    }
  });
}

const erc20MetaAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export type TokenMeta = { symbol: string; decimals: number };

async function readTokenMeta(
  token: Address,
  fallbackSymbol: string,
): Promise<TokenMeta> {
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20MetaAbi,
        functionName: "symbol",
      }),
      client.readContract({
        address: token,
        abi: erc20MetaAbi,
        functionName: "decimals",
      }),
    ]);
    return { symbol, decimals: Number(decimals) };
  } catch {
    return { symbol: fallbackSymbol, decimals: 18 };
  }
}

/** Pot payout token ($WARPGOBB) metadata; env-symbol + 18 decimals fallback. */
export async function readPayoutTokenMeta(
  fallbackSymbol: string,
): Promise<TokenMeta> {
  if (CONTRACTS.dutchAuction === ZERO_ADDRESS) {
    return { symbol: fallbackSymbol, decimals: 18 };
  }
  return cached("meta:payout", async () => {
    try {
      const token = await client.readContract({
        address: CONTRACTS.dutchAuction,
        abi: parseAbi(["function paymentToken() view returns (address)"]),
        functionName: "paymentToken",
      });
      return await readTokenMeta(token, fallbackSymbol);
    } catch {
      return { symbol: fallbackSymbol, decimals: 18 };
    }
  });
}

/** Auction bid token metadata; env-symbol + 18 decimals fallback. */
export async function readBidTokenMeta(
  fallbackSymbol: string,
): Promise<TokenMeta> {
  if (CONTRACTS.auctionSell === ZERO_ADDRESS) {
    return { symbol: fallbackSymbol, decimals: 18 };
  }
  return cached("meta:bid", async () => {
    try {
      const token = await client.readContract({
        address: CONTRACTS.auctionSell,
        abi: auctionSellAbi,
        functionName: "bidToken",
      });
      return await readTokenMeta(token, fallbackSymbol);
    } catch {
      return { symbol: fallbackSymbol, decimals: 18 };
    }
  });
}

/** Current pot balance in wei, or null when unreadable/unconfigured. */
export async function readPotWei(): Promise<bigint | null> {
  if (CONTRACTS.dutchAuction === ZERO_ADDRESS) return null;
  try {
    return await client.readContract({
      address: CONTRACTS.dutchAuction,
      abi: parseAbi(["function currentPrice() view returns (uint256)"]),
      functionName: "currentPrice",
    });
  } catch {
    return null;
  }
}

export { client as basePublicClient };
