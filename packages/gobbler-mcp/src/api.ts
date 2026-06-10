import { z } from "zod";
import type { Config } from "./config.js";

// Every field is optional: the agent API is being built in parallel and may
// ship partial payloads. Callers must handle missing fields.

const weiString = z.string().regex(/^\d+$/);
const idLike = z.union([z.number(), z.string()]);

const bidTokenSchema = z
  .object({
    address: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  })
  .partial();

const potSchema = z
  .object({
    amountWei: weiString,
    amount: z.union([z.string(), z.number()]),
    symbol: z.string(),
    ratePerSecondWei: weiString,
    usd: z.number().nullable(),
  })
  .partial();

const auctionSchema = z
  .object({
    live: z.boolean(),
    tokenId: idLike,
    topBidWei: weiString,
    topBidder: z.string(),
    endTime: z.number(),
    minNextBidWei: weiString,
    bidToken: bidTokenSchema,
    paused: z.boolean(),
    queue: z.array(idLike),
  })
  .partial();

const contractsSchema = z
  .object({
    dutchAuction: z.string(),
    auctionSell: z.string(),
    warplets: z.string(),
    warpgobbToken: z.string(),
    gobbledWarplets: z.string(),
  })
  .partial();

export const agentStateSchema = z
  .object({
    game: z.string(),
    chainId: z.number(),
    timestamp: z.number(),
    pot: potSchema,
    auction: auctionSchema,
    contracts: contractsSchema,
    actions: z.record(z.unknown()),
    links: z.record(z.unknown()),
  })
  .partial();

export type AgentState = z.infer<typeof agentStateSchema>;

const feedEventSchema = z
  .object({
    type: z.string(),
    txHash: z.string(),
    tokenId: idLike,
    actor: z.string(),
    amountWei: weiString,
    timestamp: z.number(),
  })
  .partial();

export const agentFeedSchema = z
  .object({ events: z.array(feedEventSchema) })
  .partial();

export type AgentFeed = z.infer<typeof agentFeedSchema>;
export type FeedEvent = z.infer<typeof feedEventSchema>;

async function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

export async function fetchAgentState(config: Config): Promise<AgentState> {
  const raw = await fetchJson(`${config.apiUrl}/api/agent/state`);
  const parsed = agentStateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Unexpected /api/agent/state response shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export async function fetchAgentFeed(config: Config): Promise<AgentFeed> {
  const raw = await fetchJson(`${config.apiUrl}/api/agent/feed`);
  const parsed = agentFeedSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Unexpected /api/agent/feed response shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** Best-effort state fetch — returns undefined instead of throwing. */
export async function tryFetchAgentState(
  config: Config,
): Promise<AgentState | undefined> {
  try {
    return await fetchAgentState(config);
  } catch {
    return undefined;
  }
}
