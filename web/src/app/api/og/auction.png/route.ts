import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, isAddressEqual, zeroAddress } from "viem";
import { base } from "viem/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { erc20Abi } from "@/abi/erc20";
import { baseHttp } from "@/lib/base-http";
import { CONTRACTS } from "@/lib/contracts";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { renderAuctionOg } from "@/lib/render-auction-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEGACY_AUCTION_IMAGE =
  "https://api.warpletgobbler.xyz/api/gobbler/frimg/mini/auction.png";

const publicClient = createPublicClient({ chain: base, transport: baseHttp() });

async function readBidTokenMetadata(): Promise<{
  decimals: number;
  symbol: string;
}> {
  try {
    const bidToken = await publicClient.readContract({
      address: CONTRACTS.auctionSell,
      abi: auctionSellAbi,
      functionName: "bidToken",
    });

    if (isAddressEqual(bidToken, zeroAddress)) {
      return { decimals: 18, symbol: AUCTION_BID_TOKEN_SYMBOL };
    }

    const [decimals, symbol] = await Promise.all([
      publicClient.readContract({
        address: bidToken,
        abi: erc20Abi,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: bidToken,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    ]);

    return {
      decimals: Number(decimals),
      symbol: typeof symbol === "string" ? symbol : AUCTION_BID_TOKEN_SYMBOL,
    };
  } catch {
    return { decimals: 18, symbol: AUCTION_BID_TOKEN_SYMBOL };
  }
}

export async function GET(_request: NextRequest) {
  try {
    const current = await publicClient.readContract({
      address: CONTRACTS.auctionSell,
      abi: auctionSellAbi,
      functionName: "currentAuction",
    });

    const [tokenId, , highBid, endTime] = current;
    if (tokenId <= 0n) {
      return NextResponse.redirect(LEGACY_AUCTION_IMAGE, 302);
    }

    const [{ url: gobbledImageUrl }, bidToken] = await Promise.all([
      ensureGobbledImage(Number(tokenId)),
      readBidTokenMetadata(),
    ]);

    const image = await renderAuctionOg({
      tokenId: Number(tokenId),
      gobbledImageUrl,
      topBidWei: highBid,
      bidDecimals: bidToken.decimals,
      bidSymbol: bidToken.symbol,
      endTime,
    });

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.warn("[auction-og] render failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(LEGACY_AUCTION_IMAGE, 302);
  }
}
