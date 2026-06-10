import { NextRequest, NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { computeLogScanWindows } from "@/lib/log-scan";
import { basePublicClient } from "@/lib/share/onchain-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recent gobbles + auction settlements as plain JSON — the activity feed half
 * of the agent API. Scans a bounded recent window of Base blocks (newest
 * first, capped RPC-friendly chunks), so it needs no indexer to run.
 */

const GOBBLED_EVENT = parseAbiItem(
  "event Gobbled(address indexed seller, uint256 indexed tokenId, uint256 payout)",
);
const SETTLED_EVENT = parseAbiItem(
  "event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount, uint256 gobbledTokenId)",
);

/** ~24h of Base blocks (2s), walked in RPC-cap-friendly chunks. */
const LOOKBACK_BLOCKS = 43_200n;
const CHUNK_BLOCKS = 9_500n;
const MAX_WINDOWS = 6;

export type FeedEvent = {
  type: "gobble" | "settled";
  txHash: string;
  blockNumber: string;
  tokenId: number;
  actor: string;
  amountWei: string;
  gobbledTokenId?: string;
  shareUrl: string;
};

export async function GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isInteger(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 20;

  if (
    CONTRACTS.dutchAuction === ZERO_ADDRESS &&
    CONTRACTS.auctionSell === ZERO_ADDRESS
  ) {
    return NextResponse.json(
      { events: [], note: "contracts unconfigured" },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const events: FeedEvent[] = [];
  try {
    const latest = await basePublicClient.getBlockNumber();
    const windows = computeLogScanWindows(
      latest,
      LOOKBACK_BLOCKS,
      CHUNK_BLOCKS,
    ).slice(0, MAX_WINDOWS);

    for (const window of windows) {
      const [gobbles, settles] = await Promise.all([
        CONTRACTS.dutchAuction === ZERO_ADDRESS
          ? Promise.resolve([])
          : basePublicClient.getLogs({
              address: CONTRACTS.dutchAuction,
              event: GOBBLED_EVENT,
              fromBlock: window.fromBlock,
              toBlock: window.toBlock,
            }),
        CONTRACTS.auctionSell === ZERO_ADDRESS
          ? Promise.resolve([])
          : basePublicClient.getLogs({
              address: CONTRACTS.auctionSell,
              event: SETTLED_EVENT,
              fromBlock: window.fromBlock,
              toBlock: window.toBlock,
            }),
      ]);

      for (const log of gobbles) {
        events.push({
          type: "gobble",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber.toString(),
          tokenId: Number(log.args.tokenId ?? 0n),
          actor: log.args.seller ?? "0x",
          amountWei: (log.args.payout ?? 0n).toString(),
          shareUrl: `/g/${log.transactionHash}`,
        });
      }
      for (const log of settles) {
        events.push({
          type: "settled",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber.toString(),
          tokenId: Number(log.args.tokenId ?? 0n),
          actor: log.args.winner ?? "0x",
          amountWei: (log.args.amount ?? 0n).toString(),
          gobbledTokenId: (log.args.gobbledTokenId ?? 0n).toString(),
          shareUrl: `/w/${log.transactionHash}`,
        });
      }

      if (events.length >= limit) break;
    }
  } catch (e) {
    console.warn("[agent-feed] log scan failed", e);
    return NextResponse.json(
      { events: [], error: "log scan failed; try again" },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  events.sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)));

  return NextResponse.json(
    { events: events.slice(0, limit) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
