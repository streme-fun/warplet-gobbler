#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { formatUnits, type Address, type Hex } from "viem";
import { z } from "zod";
import {
  fetchAgentFeed,
  tryFetchAgentState,
  type AgentState,
} from "./api.js";
import {
  ZERO_ADDRESS,
  buildBidCalldata,
  buildGobbleCalldata,
  computeMinNextBid,
  getPublicClient,
  getWalletClient,
  readAuctionSellState,
  readCurrentPrice,
  readNetFlowRate,
  readPaymentToken,
  readTokenMeta,
} from "./chain.js";
import { DEFAULT_WARPLETS_ADDRESS, loadConfig } from "./config.js";

const config = loadConfig();

const server = new McpServer({ name: "warplet-gobbler", version: "0.1.0" });

// ---------------------------------------------------------------------------
// Shared helpers

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const addressSchema = z
  .string()
  .regex(ADDRESS_RE, "must be a 0x-prefixed 20-byte hex address");
const hexDataSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, "must be 0x-prefixed hex calldata");
const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 32-byte tx hash");
const weiSchema = z
  .string()
  .regex(/^\d+$/, "must be a decimal string of wei (no 0x, no decimals)");
const tokenIdSchema = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/, "decimal token id"),
]);

/** JSON.stringify that never throws on bigint (defense in depth). */
function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: toJson(value) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asAddress(value: string | undefined): Address | undefined {
  return value !== undefined && ADDRESS_RE.test(value)
    ? (value as Address)
    : undefined;
}

interface ResolvedAddresses {
  dutchAuction?: Address;
  auctionSell?: Address;
  warplets: Address;
  warpgobbToken?: Address;
  gobbledWarplets?: Address;
}

/** Env overrides win, then the agent API, then known defaults. */
function resolveAddresses(state?: AgentState): ResolvedAddresses {
  const api = state?.contracts ?? {};
  return {
    dutchAuction: config.dutchAuction ?? asAddress(api.dutchAuction),
    auctionSell: config.auctionSell ?? asAddress(api.auctionSell),
    warplets:
      config.warpletsOverride ??
      asAddress(api.warplets) ??
      DEFAULT_WARPLETS_ADDRESS,
    warpgobbToken: config.warpgobbToken ?? asAddress(api.warpgobbToken),
    gobbledWarplets: asAddress(api.gobbledWarplets),
  };
}

/**
 * Resolve addresses without an API round-trip when env config already covers
 * what the caller needs; otherwise consult the agent API too.
 */
async function resolveAddressesLazy(
  need: ReadonlyArray<"dutchAuction" | "auctionSell">,
): Promise<ResolvedAddresses> {
  const fromEnv = resolveAddresses();
  if (need.every((key) => fromEnv[key] !== undefined)) return fromEnv;
  return resolveAddresses(await tryFetchAgentState(config));
}

function formatAmount(wei: bigint, decimals: number): string {
  return formatUnits(wei, decimals);
}

interface SummaryInput {
  potAmountWei?: bigint;
  potSymbol?: string;
  potUsd?: number | null;
  auctionLive?: boolean;
  auctionTokenId?: string;
  minNextBidWei?: bigint;
  bidSymbol?: string;
  bidDecimals?: number;
  queueLength?: number;
  paused?: boolean;
}

function buildWhatYouCanDo(input: SummaryInput): string {
  const lines: string[] = [];
  if (input.potAmountWei !== undefined) {
    const human = formatAmount(input.potAmountWei, 18);
    const usd =
      input.potUsd != null ? ` (~$${input.potUsd.toFixed(2)})` : "";
    lines.push(
      `The pot currently holds ${human} ${input.potSymbol ?? "WARPGOBB"}${usd} and grows every second via a Superfluid stream.`,
    );
  }
  lines.push(
    "If you control a Warplet NFT you can drain the ENTIRE pot in one transaction: call build_gobble_tx with your address as `from` and your tokenId, then submit the returned transaction.",
  );
  if (input.auctionLive) {
    const min =
      input.minNextBidWei !== undefined
        ? ` Minimum next bid: ${formatAmount(input.minNextBidWei, input.bidDecimals ?? 18)} ${input.bidSymbol ?? "(bid token)"}.`
        : "";
    lines.push(
      `A FIFO sell auction is live for gobbled Warplet #${input.auctionTokenId ?? "?"}.${min} Call build_bid_tx to prepare a bid.`,
    );
  } else if (input.paused) {
    lines.push("The sell auction is currently paused; bids will not succeed.");
  } else {
    lines.push("No sell auction is live right now.");
  }
  if (input.queueLength !== undefined && input.queueLength > 0) {
    lines.push(
      `${input.queueLength} gobbled Warplet(s) are queued for future auctions.`,
    );
  }
  lines.push(
    config.agentPrivateKey
      ? "send_tx is enabled: it signs and submits transactions on Base with the configured agent key."
      : "send_tx is disabled (no AGENT_PRIVATE_KEY); sign and submit the returned transactions with your own wallet.",
  );
  lines.push(
    "After a successful gobble or auction win, call compose_brag to get Farcaster cast text with a rich share embed.",
  );
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// get_game_state

interface PotOutput {
  amountWei: string | null;
  amount: string | null;
  symbol: string | null;
  ratePerSecondWei: string | null;
  usd: number | null;
}

interface AuctionOutput {
  live: boolean | null;
  tokenId: string | null;
  topBidWei: string | null;
  topBidder: string | null;
  endTime: number | null;
  minNextBidWei: string | null;
  bidToken: { address: string | null; symbol: string | null; decimals: number | null };
  paused: boolean | null;
  queue: string[];
}

async function buildGameStateFromRpc(addrs: ResolvedAddresses): Promise<{
  pot: PotOutput | null;
  auction: AuctionOutput | null;
  summary: SummaryInput;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let pot: PotOutput | null = null;
  let auction: AuctionOutput | null = null;
  const summary: SummaryInput = {};

  if (addrs.dutchAuction) {
    try {
      const amountWei = await readCurrentPrice(config, addrs.dutchAuction);
      const token =
        addrs.warpgobbToken ??
        (await readPaymentToken(config, addrs.dutchAuction));
      const meta = await readTokenMeta(config, token);
      const rate = await readNetFlowRate(config, token, addrs.dutchAuction);
      pot = {
        amountWei: amountWei.toString(),
        amount: formatAmount(amountWei, meta.decimals),
        symbol: meta.symbol,
        ratePerSecondWei: rate === null ? null : rate.toString(),
        usd: null,
      };
      summary.potAmountWei = amountWei;
      summary.potSymbol = meta.symbol ?? undefined;
    } catch (error) {
      warnings.push(`Could not read pot state: ${errorMessage(error)}`);
    }
  } else {
    warnings.push(
      "DutchAuction address unknown (set DUTCH_AUCTION_ADDRESS or make the agent API reachable) — pot state omitted.",
    );
  }

  if (addrs.auctionSell) {
    try {
      const s = await readAuctionSellState(config, addrs.auctionSell);
      const bidMeta = await readTokenMeta(config, s.bidToken);
      const minNextBid = computeMinNextBid(
        s.lot,
        s.reservePrice,
        s.minBidIncrementPercentage,
      );
      const now = BigInt(Math.floor(Date.now() / 1000));
      const live = s.lot.tokenId !== 0n && s.lot.endTime > now && !s.paused;
      auction = {
        live,
        tokenId: s.lot.tokenId.toString(),
        topBidWei: s.lot.amount.toString(),
        topBidder: s.lot.bidder,
        endTime: Number(s.lot.endTime),
        minNextBidWei: minNextBid.toString(),
        bidToken: {
          address: s.bidToken,
          symbol: bidMeta.symbol,
          decimals: bidMeta.decimals,
        },
        paused: s.paused,
        queue: s.queue.map((id) => id.toString()),
      };
      summary.auctionLive = live;
      summary.auctionTokenId = auction.tokenId ?? undefined;
      summary.minNextBidWei = minNextBid;
      summary.bidSymbol = bidMeta.symbol ?? undefined;
      summary.bidDecimals = bidMeta.decimals;
      summary.queueLength = s.queue.length;
      summary.paused = s.paused;
    } catch (error) {
      warnings.push(`Could not read auction state: ${errorMessage(error)}`);
    }
  } else {
    warnings.push(
      "AuctionSell address unknown (set AUCTION_SELL_ADDRESS or make the agent API reachable) — auction state omitted.",
    );
  }

  return { pot, auction, summary, warnings };
}

server.registerTool(
  "get_game_state",
  {
    title: "Get WarpletGobbler game state",
    description:
      "Snapshot of the WarpletGobbler game on Base (chainId 8453): current pot size and streaming rate, the live FIFO auction for gobbled Warplets (top bid, minimum next bid, end time), the auction queue, contract addresses, and a plain-English `whatYouCanDo` summary. Call this first to decide whether gobbling or bidding is profitable. Prefers the hosted agent API and falls back to direct RPC reads.",
    inputSchema: {},
  },
  async () => {
    try {
      const state = await tryFetchAgentState(config);
      const addrs = resolveAddresses(state);
      const base = {
        game: state?.game ?? "warplet-gobbler",
        chainId: state?.chainId ?? 8453,
        timestamp: state?.timestamp ?? Math.floor(Date.now() / 1000),
        contracts: addrs,
      };

      if (state) {
        const summary: SummaryInput = {
          potAmountWei:
            state.pot?.amountWei !== undefined
              ? BigInt(state.pot.amountWei)
              : undefined,
          potSymbol: state.pot?.symbol,
          potUsd: state.pot?.usd,
          auctionLive: state.auction?.live,
          auctionTokenId:
            state.auction?.tokenId !== undefined
              ? String(state.auction.tokenId)
              : undefined,
          minNextBidWei:
            state.auction?.minNextBidWei !== undefined
              ? BigInt(state.auction.minNextBidWei)
              : undefined,
          bidSymbol: state.auction?.bidToken?.symbol,
          bidDecimals: state.auction?.bidToken?.decimals,
          queueLength: state.auction?.queue?.length,
          paused: state.auction?.paused,
        };
        return jsonResult({
          source: "api",
          ...base,
          pot: state.pot ?? null,
          auction: state.auction ?? null,
          links: state.links ?? null,
          whatYouCanDo: buildWhatYouCanDo(summary),
        });
      }

      if (!addrs.dutchAuction && !addrs.auctionSell) {
        return errorResult(
          `The agent API at ${config.apiUrl}/api/agent/state is unreachable and no contract addresses are configured. Set DUTCH_AUCTION_ADDRESS and AUCTION_SELL_ADDRESS env vars to enable direct RPC reads, or point GOBBLER_API_URL at a live deployment.`,
        );
      }

      const rpc = await buildGameStateFromRpc(addrs);
      return jsonResult({
        source: "rpc",
        ...base,
        pot: rpc.pot,
        auction: rpc.auction,
        warnings: rpc.warnings.length > 0 ? rpc.warnings : undefined,
        whatYouCanDo: buildWhatYouCanDo(rpc.summary),
      });
    } catch (error) {
      return errorResult(`get_game_state failed: ${errorMessage(error)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// build_gobble_tx

server.registerTool(
  "build_gobble_tx",
  {
    title: "Build a gobble transaction",
    description:
      "Build the one-transaction 'gobble': deposit a Warplet NFT you own into the Gobbler (DutchAuction) and receive the ENTIRE streamed pot in return. Returns an unsigned transaction {to, data, value} calling warplets.safeTransferFrom(from, dutchAuction, tokenId, abi.encode(minPrice)). minPrice is frontrun protection: the tx reverts on-chain if the pot drops below it (i.e. someone gobbled first). If minPriceWei is omitted it is computed as currentPrice minus slippageBps. The transaction MUST be sent from `from`, the address that owns the Warplet. Submit it with send_tx or your own wallet.",
    inputSchema: {
      from: addressSchema.describe(
        "Address that currently owns the Warplet. safeTransferFrom encodes this as the token owner, so the transaction must be signed by this address.",
      ),
      tokenId: tokenIdSchema.describe("Warplet token id to deposit (gobble)."),
      minPriceWei: weiSchema
        .optional()
        .describe(
          "Optional explicit minimum pot payout in wei. If the pot is below this at execution time the tx reverts. Defaults to currentPrice minus slippageBps.",
        ),
      slippageBps: z
        .number()
        .int()
        .min(0)
        .max(10_000)
        .default(100)
        .describe(
          "Slippage tolerance in basis points used to derive minPrice from the live pot size (100 = accept 1% less than the snapshot). Ignored when minPriceWei is given.",
        ),
    },
  },
  async ({ from, tokenId, minPriceWei, slippageBps }) => {
    try {
      const addrs = await resolveAddressesLazy(["dutchAuction"]);
      if (!addrs.dutchAuction) {
        return errorResult(
          "DutchAuction address unknown. Set the DUTCH_AUCTION_ADDRESS env var, or ensure the agent API (GOBBLER_API_URL) is reachable so it can be discovered.",
        );
      }

      let currentPrice: bigint | undefined;
      try {
        currentPrice = await readCurrentPrice(config, addrs.dutchAuction);
      } catch (error) {
        if (minPriceWei === undefined) {
          return errorResult(
            `Could not read currentPrice from DutchAuction ${addrs.dutchAuction} (${errorMessage(error)}) and no minPriceWei was provided. Provide minPriceWei explicitly or fix BASE_RPC_URL.`,
          );
        }
      }

      const minPrice =
        minPriceWei !== undefined
          ? BigInt(minPriceWei)
          : currentPrice !== undefined
            ? (currentPrice * BigInt(10_000 - slippageBps)) / 10_000n
            : undefined;
      if (minPrice === undefined) {
        // Unreachable: the currentPrice read failure above already returned.
        return errorResult("Could not determine minPrice.");
      }

      const id = BigInt(tokenId);
      const data = buildGobbleCalldata(
        from as Address,
        addrs.dutchAuction,
        id,
        minPrice,
      );

      return jsonResult({
        to: addrs.warplets,
        data,
        value: "0",
        from,
        chainId: 8453,
        currentPriceWei: currentPrice?.toString() ?? null,
        minPriceWei: minPrice.toString(),
        slippageBps: minPriceWei !== undefined ? null : slippageBps,
        description: `safeTransferFrom(${from} -> ${addrs.dutchAuction}, Warplet #${id}, abi.encode(minPrice=${minPrice})). Deposits the Warplet into the Gobbler; you receive the full pot (currently ${currentPrice?.toString() ?? "unknown"} wei of the payment token). Reverts if the pot falls below minPrice before inclusion.`,
        notes: [
          "Send this transaction from `from` — it must be the Warplet's current owner.",
          "No prior approval is needed: safeTransferFrom is called by the owner directly.",
        ],
      });
    } catch (error) {
      return errorResult(`build_gobble_tx failed: ${errorMessage(error)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// build_bid_tx

server.registerTool(
  "build_bid_tx",
  {
    title: "Build an auction bid transaction",
    description:
      "Build a bid on the live FIFO auction of gobbled Warplets. Returns an unsigned transaction {to, data, value} that calls send(auctionSell, amount, \"0x\") on the bid SuperToken (ERC777) — AuctionSell's tokensReceived hook registers the bid in the same transaction, so no approval is needed. If amountWei is omitted, the minimum valid next bid is used (reserve price when no bids yet, otherwise top bid plus the minimum increment). You must hold at least `amount` of the bid token. Submit with send_tx or your own wallet.",
    inputSchema: {
      amountWei: weiSchema
        .optional()
        .describe(
          "Bid amount in wei of the bid token. Defaults to the minimum valid next bid.",
        ),
    },
  },
  async ({ amountWei }) => {
    try {
      const state = await tryFetchAgentState(config);
      const addrs = resolveAddresses(state);
      if (!addrs.auctionSell) {
        return errorResult(
          "AuctionSell address unknown. Set the AUCTION_SELL_ADDRESS env var, or ensure the agent API (GOBBLER_API_URL) is reachable so it can be discovered.",
        );
      }

      let bidToken = asAddress(state?.auction?.bidToken?.address);
      let bidSymbol = state?.auction?.bidToken?.symbol ?? null;
      let bidDecimals = state?.auction?.bidToken?.decimals ?? 18;
      let minNextBid =
        state?.auction?.minNextBidWei !== undefined
          ? BigInt(state.auction.minNextBidWei)
          : undefined;
      let live = state?.auction?.live;

      if (!bidToken || (amountWei === undefined && minNextBid === undefined)) {
        const s = await readAuctionSellState(config, addrs.auctionSell);
        bidToken = s.bidToken;
        minNextBid = computeMinNextBid(
          s.lot,
          s.reservePrice,
          s.minBidIncrementPercentage,
        );
        const meta = await readTokenMeta(config, bidToken);
        bidSymbol = meta.symbol;
        bidDecimals = meta.decimals;
        const now = BigInt(Math.floor(Date.now() / 1000));
        live = s.lot.tokenId !== 0n && s.lot.endTime > now && !s.paused;
      }
      if (!bidToken || bidToken === ZERO_ADDRESS) {
        return errorResult(
          "Could not determine the bid token address from the agent API or AuctionSell.bidToken().",
        );
      }

      const amount = amountWei !== undefined ? BigInt(amountWei) : minNextBid;
      if (amount === undefined) {
        return errorResult(
          "Could not determine a default bid amount; pass amountWei explicitly.",
        );
      }

      const meetsMinimum =
        minNextBid !== undefined ? amount >= minNextBid : null;

      return jsonResult({
        to: bidToken,
        data: buildBidCalldata(addrs.auctionSell, amount),
        value: "0",
        chainId: 8453,
        amountWei: amount.toString(),
        amount: formatAmount(amount, bidDecimals),
        bidToken: { address: bidToken, symbol: bidSymbol, decimals: bidDecimals },
        minNextBidWei: minNextBid?.toString() ?? null,
        meetsMinimum,
        auctionLive: live ?? null,
        description: `ERC777 send(${addrs.auctionSell}, ${amount}, "0x") on bid token ${bidSymbol ?? bidToken}. The transfer's tokensReceived hook places the bid; losing bids are refunded by the contract.`,
        notes: [
          meetsMinimum === false
            ? `WARNING: amount is below the minimum next bid (${minNextBid}); the transaction will revert.`
            : "Bid meets the minimum (or minimum unknown).",
          `Alternative path: bidToken.approve(${addrs.auctionSell}, amount) followed by AuctionSell.bid(amount) — two transactions instead of one.`,
        ],
      });
    } catch (error) {
      return errorResult(`build_bid_tx failed: ${errorMessage(error)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// send_tx — only when a signer is configured

const walletClient = getWalletClient(config);

if (walletClient) {
  server.registerTool(
    "send_tx",
    {
      title: "Sign and send a transaction on Base",
      description:
        `Sign and submit a transaction on Base (chainId 8453) using the configured agent key (account ${walletClient.account.address}), then wait for the receipt. Use with the outputs of build_gobble_tx or build_bid_tx. Note: a gobble tx is only valid if the agent account owns the Warplet (build_gobble_tx \`from\` must equal the agent address).`,
      inputSchema: {
        to: addressSchema.describe("Transaction recipient (contract address)."),
        data: hexDataSchema.describe("0x-prefixed calldata."),
        value: weiSchema
          .optional()
          .describe("ETH value in wei as a decimal string. Defaults to 0."),
      },
    },
    async ({ to, data, value }) => {
      try {
        const hash = await walletClient.sendTransaction({
          to: to as Address,
          data: data as Hex,
          value: value !== undefined ? BigInt(value) : 0n,
        });
        const receipt = await getPublicClient(config).waitForTransactionReceipt({
          hash,
        });
        return jsonResult({
          hash,
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          from: walletClient.account.address,
          explorer: `https://basescan.org/tx/${hash}`,
        });
      } catch (error) {
        return errorResult(`send_tx failed: ${errorMessage(error)}`);
      }
    },
  );
} else {
  // Keep stdout clean (MCP protocol); stderr is fine for diagnostics.
  console.error(
    "gobbler-mcp: AGENT_PRIVATE_KEY not set — send_tx tool disabled; transactions must be signed externally.",
  );
}

// ---------------------------------------------------------------------------
// compose_brag

server.registerTool(
  "compose_brag",
  {
    title: "Compose a Farcaster brag cast",
    description:
      "After a successful gobble or auction win, get suggested Farcaster cast text plus a share embed URL that renders a rich card for the transaction. Returns a ready-to-open Warpcast compose intent URL (https://farcaster.xyz/~/compose?text=...&embeds[]=...). Rewrite the text in your own voice if you like, but keep the embed URL so the cast shows the rich card.",
    inputSchema: {
      kind: z
        .enum(["gobble", "win"])
        .describe(
          "'gobble' = you drained the pot by depositing a Warplet; 'win' = you won a gobbled Warplet at auction.",
        ),
      txHash: txHashSchema.describe(
        "Hash of the successful gobble or winning-settlement transaction on Base.",
      ),
    },
  },
  async ({ kind, txHash }) => {
    const embedUrl =
      kind === "gobble"
        ? `${config.apiUrl}/g/${txHash}`
        : `${config.apiUrl}/w/${txHash}`;
    const text =
      kind === "gobble"
        ? "I just gobbled a Warplet and drained the entire $WARPGOBB pot. The Gobbler always pays."
        : "I just won a gobbled Warplet at auction on WarpletGobbler. Fresh from the belly of the beast.";
    const composeUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;
    return jsonResult({
      text,
      embedUrl,
      composeUrl,
      notes: [
        "Open composeUrl in a browser to prefill the cast, or publish via a Farcaster API client with `text` and embedUrl as the embed.",
        "Feel free to rewrite `text` in your own voice; keep embedUrl as the embed for the rich card.",
      ],
    });
  },
);

// ---------------------------------------------------------------------------
// get_recent_gobbles

server.registerTool(
  "get_recent_gobbles",
  {
    title: "Get recent gobbles and settlements",
    description:
      "Recent game activity from the hosted agent feed: 'gobble' events (someone deposited a Warplet and drained the pot) and 'settled' events (an auction for a gobbled Warplet concluded). Useful for gauging how often the pot gets drained and at what size, to time your own gobble.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe("Maximum number of events to return (newest first)."),
    },
  },
  async ({ limit }) => {
    try {
      const feed = await fetchAgentFeed(config);
      const events = (feed.events ?? []).slice(0, limit).map((event) => ({
        ...event,
        tokenId:
          event.tokenId !== undefined ? String(event.tokenId) : undefined,
      }));
      return jsonResult({ count: events.length, events });
    } catch (error) {
      return errorResult(
        `Could not fetch ${config.apiUrl}/api/agent/feed: ${errorMessage(error)}. The agent feed API may not be deployed yet — get_game_state still works (it falls back to direct RPC reads).`,
      );
    }
  },
);

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `gobbler-mcp: serving WarpletGobbler tools over stdio (api: ${config.apiUrl}, rpc: ${config.rpcUrl}, send_tx: ${walletClient ? "enabled" : "disabled"})`,
  );
}

main().catch((error: unknown) => {
  console.error("gobbler-mcp: fatal:", error);
  process.exit(1);
});
