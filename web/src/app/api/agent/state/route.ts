import { NextResponse } from "next/server";
import { formatUnits, parseAbi, zeroAddress } from "viem";
import { auctionSellAbi } from "@/abi/auctionSell";
import { appUrl } from "@/lib/miniapp-embed";
import {
  AUCTION_BID_TOKEN_SYMBOL,
  PAYMENT_TOKEN_SYMBOL,
} from "@/lib/paymentToken";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import {
  basePublicClient,
  readBidTokenMeta,
  readPayoutTokenMeta,
  readPotWei,
} from "@/lib/share/onchain-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public machine-readable game state — the front door for AI agents (and the
 * gobbler-mcp server). No auth, no key: everything here is public chain data
 * shaped into one cheap GET. See /llms.txt for the prose version.
 */

/** Superfluid CFAv1Forwarder (same address on every network). */
const CFA_FORWARDER = "0xcfA132E353cB4E398080B9700609bb008eceB125" as const;
const cfaForwarderAbi = parseAbi([
  "function getAccountFlowrate(address token, address account) view returns (int96)",
]);

async function readPotFlowRate(): Promise<bigint | null> {
  if (
    CONTRACTS.dutchAuction === ZERO_ADDRESS ||
    CONTRACTS.warpgobbToken === ZERO_ADDRESS
  ) {
    return null;
  }
  try {
    return await basePublicClient.readContract({
      address: CFA_FORWARDER,
      abi: cfaForwarderAbi,
      functionName: "getAccountFlowrate",
      args: [CONTRACTS.warpgobbToken, CONTRACTS.dutchAuction],
    });
  } catch {
    return null;
  }
}

async function readAuctionState() {
  if (CONTRACTS.auctionSell === ZERO_ADDRESS) return null;
  try {
    const reads = await basePublicClient.multicall({
      contracts: [
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "auction" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "paused" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "reservePrice" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "minBidIncrementPercentage" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "getQueuedTokenIds" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "queueBumpFee" },
        { address: CONTRACTS.auctionSell, abi: auctionSellAbi, functionName: "bidToken" },
      ],
    });
    const [lotR, pausedR, reserveR, incR, queueR, bumpFeeR, bidTokenR] = reads;
    if (lotR.status !== "success") return null;
    const lot = lotR.result;
    const paused = pausedR.status === "success" ? pausedR.result : false;
    const reserve = reserveR.status === "success" ? reserveR.result : 0n;
    const incrementPct = incR.status === "success" ? Number(incR.result) : 0;
    const queue =
      queueR.status === "success" ? queueR.result.map((id) => Number(id)) : [];
    const bumpFee = bumpFeeR.status === "success" ? bumpFeeR.result : null;
    const bidTokenAddress =
      bidTokenR.status === "success" ? bidTokenR.result : null;

    const hasBid = lot.bidder !== zeroAddress && lot.amount > 0n;
    const minNextBid = hasBid
      ? lot.amount + (lot.amount * BigInt(incrementPct)) / 100n
      : reserve;
    const now = Math.floor(Date.now() / 1000);
    const live =
      lot.tokenId > 0n && Number(lot.endTime) > now && !paused;

    return {
      live,
      paused,
      tokenId: Number(lot.tokenId),
      topBidWei: lot.amount.toString(),
      topBidder: hasBid ? lot.bidder : null,
      startTime: Number(lot.startTime),
      endTime: Number(lot.endTime),
      minNextBidWei: minNextBid.toString(),
      minBidIncrementPercentage: incrementPct,
      queue,
      queueBumpFeeWei: bumpFee?.toString() ?? null,
      bidTokenAddress,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [potWei, flowRateWei, payoutMeta, bidMeta, auction] =
    await Promise.all([
      readPotWei(),
      readPotFlowRate(),
      readPayoutTokenMeta(PAYMENT_TOKEN_SYMBOL),
      readBidTokenMeta(AUCTION_BID_TOKEN_SYMBOL),
      readAuctionState(),
    ]);

  const bidTokenAddress = auction?.bidTokenAddress ?? null;

  const state = {
    game: "WarpletGobbler",
    chainId: 8453,
    timestamp: new Date().toISOString(),
    pot: {
      amountWei: potWei?.toString() ?? null,
      amount:
        potWei != null
          ? Number(formatUnits(potWei, payoutMeta.decimals))
          : null,
      symbol: payoutMeta.symbol,
      decimals: payoutMeta.decimals,
      ratePerSecondWei: flowRateWei?.toString() ?? null,
      usd: null,
    },
    auction:
      auction == null
        ? null
        : {
            ...auction,
            // Folded into the structured bidToken object below; undefined
            // drops out of the JSON serialization.
            bidTokenAddress: undefined,
            bidToken: {
              address: bidTokenAddress,
              symbol: bidMeta.symbol,
              decimals: bidMeta.decimals,
            },
          },
    contracts: {
      dutchAuction: CONTRACTS.dutchAuction,
      auctionSell: CONTRACTS.auctionSell,
      warplets: CONTRACTS.warplets,
      warpgobbToken: CONTRACTS.warpgobbToken,
      gobbledWarplets: CONTRACTS.gobbledWarplets,
      staking: CONTRACTS.staking,
    },
    actions: {
      gobble: {
        summary:
          "Drain the entire pot by depositing a Warplet you own. One transaction: warplets.safeTransferFrom(you, dutchAuction, tokenId, abi.encode(uint256 minPrice)). minPrice is your slippage floor — use pot.amountWei minus ~1%.",
        contract: CONTRACTS.warplets,
        method: "safeTransferFrom(address,address,uint256,bytes)",
      },
      bid: {
        summary:
          "Bid on the gobbled Warplet at auction by sending the bid SuperToken: bidToken.send(auctionSell, amountWei, '0x') with amountWei >= auction.minNextBidWei. (ERC777 send — no approval needed.)",
        contract: bidTokenAddress,
        method: "send(address,uint256,bytes)",
      },
    },
    links: {
      app: appUrl,
      llms: `${appUrl}/llms.txt`,
      feed: `${appUrl}/api/agent/feed`,
      shareGobble: `${appUrl}/g/{txHash}`,
      shareWin: `${appUrl}/w/{txHash}`,
      referralLeaderboard: `${appUrl}/api/referral/leaderboard`,
    },
  };

  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
