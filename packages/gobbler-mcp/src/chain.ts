import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import type { Config } from "./config.js";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

// Canonical Superfluid CFAv1Forwarder (same address on every network).
const CFA_V1_FORWARDER =
  "0xcfA132E353cB4E398080B9700609bb008eceB125" as Address;

// Minimal ABIs, mirrored from web/src/abi/ (the deployed-contract shapes).

const dutchAuctionAbi = [
  {
    type: "function",
    name: "currentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "paymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "warplets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

// Deployed AuctionSell returns a 5-field auction() struct (no settled flag);
// settlement is derived from endTime. See web/src/abi/auctionSell.ts.
const auctionSellAbi = [
  {
    type: "function",
    name: "auction",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "bidder", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "bidToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "reservePrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "minBidIncrementPercentage",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "getQueuedTokenIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const erc721Abi = [
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const erc777Abi = [
  {
    type: "function",
    name: "send",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const cfaForwarderAbi = [
  {
    type: "function",
    name: "getAccountFlowrate",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "flowrate", type: "int96" }],
  },
] as const;

type PublicClient = ReturnType<typeof makePublicClient>;

function makePublicClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

let cachedClient: PublicClient | undefined;

export function getPublicClient(config: Config): PublicClient {
  cachedClient ??= makePublicClient(config.rpcUrl);
  return cachedClient;
}

export function getWalletClient(config: Config) {
  if (!config.agentPrivateKey) return undefined;
  const account = privateKeyToAccount(config.agentPrivateKey);
  return createWalletClient({ account, chain: base, transport: http(config.rpcUrl) });
}

// ---------------------------------------------------------------------------
// Reads

export async function readCurrentPrice(
  config: Config,
  dutchAuction: Address,
): Promise<bigint> {
  return getPublicClient(config).readContract({
    address: dutchAuction,
    abi: dutchAuctionAbi,
    functionName: "currentPrice",
  });
}

export async function readPaymentToken(
  config: Config,
  dutchAuction: Address,
): Promise<Address> {
  return getPublicClient(config).readContract({
    address: dutchAuction,
    abi: dutchAuctionAbi,
    functionName: "paymentToken",
  });
}

export interface TokenMeta {
  symbol: string | null;
  decimals: number;
}

export async function readTokenMeta(
  config: Config,
  token: Address,
): Promise<TokenMeta> {
  const client = getPublicClient(config);
  const [symbol, decimals] = await Promise.all([
    client
      .readContract({ address: token, abi: erc20Abi, functionName: "symbol" })
      .catch(() => null),
    client
      .readContract({ address: token, abi: erc20Abi, functionName: "decimals" })
      .catch(() => 18),
  ]);
  return { symbol, decimals };
}

/** Net Superfluid flow rate (wei/sec) into `account` for `token`; null if unreadable. */
export async function readNetFlowRate(
  config: Config,
  token: Address,
  account: Address,
): Promise<bigint | null> {
  try {
    return await getPublicClient(config).readContract({
      address: CFA_V1_FORWARDER,
      abi: cfaForwarderAbi,
      functionName: "getAccountFlowrate",
      args: [token, account],
    });
  } catch {
    return null;
  }
}

export interface AuctionLot {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  endTime: bigint;
  bidder: Address;
}

export interface AuctionSellState {
  lot: AuctionLot;
  bidToken: Address;
  reservePrice: bigint;
  minBidIncrementPercentage: number;
  queue: readonly bigint[];
  paused: boolean;
}

export async function readAuctionSellState(
  config: Config,
  auctionSell: Address,
): Promise<AuctionSellState> {
  const client = getPublicClient(config);
  const [lot, bidToken, reservePrice, minBidIncrementPercentage, queue, paused] =
    await Promise.all([
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "auction",
      }),
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "bidToken",
      }),
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "reservePrice",
      }),
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "minBidIncrementPercentage",
      }),
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "getQueuedTokenIds",
      }),
      client.readContract({
        address: auctionSell,
        abi: auctionSellAbi,
        functionName: "paused",
      }),
    ]);
  return { lot, bidToken, reservePrice, minBidIncrementPercentage, queue, paused };
}

/**
 * Nouns/DegenDogs-style minimum: reserve when there's no bidder yet,
 * otherwise top bid plus minBidIncrementPercentage percent.
 */
export function computeMinNextBid(
  lot: Pick<AuctionLot, "amount" | "bidder">,
  reservePrice: bigint,
  minBidIncrementPercentage: number,
): bigint {
  if (lot.amount === 0n || lot.bidder.toLowerCase() === ZERO_ADDRESS) {
    return reservePrice;
  }
  return lot.amount + (lot.amount * BigInt(minBidIncrementPercentage)) / 100n;
}

// ---------------------------------------------------------------------------
// Tx builders

/**
 * One-tx gobble: `warplets.safeTransferFrom(owner, dutchAuction, tokenId,
 * abi.encode(minPrice))` — the Gobbler's onERC721Received decodes minPrice
 * and reverts if the pot has dropped below it (frontrun protection).
 */
export function buildGobbleCalldata(
  from: Address,
  dutchAuction: Address,
  tokenId: bigint,
  minPrice: bigint,
): Hex {
  const userData = encodeAbiParameters([{ type: "uint256" }], [minPrice]);
  return encodeFunctionData({
    abi: erc721Abi,
    functionName: "safeTransferFrom",
    args: [from, dutchAuction, tokenId, userData],
  });
}

/**
 * ERC777 bid: `bidToken.send(auctionSell, amount, "0x")` — the SuperToken's
 * tokensReceived hook on AuctionSell registers the bid in the same tx.
 */
export function buildBidCalldata(auctionSell: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc777Abi,
    functionName: "send",
    args: [auctionSell, amount, "0x"],
  });
}
