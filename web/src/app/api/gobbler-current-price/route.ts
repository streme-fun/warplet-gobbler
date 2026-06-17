import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { dutchAuctionAbi } from "@/abi/dutchAuction";
import { MAINNET_DUTCH_AUCTION_V2 } from "@/lib/gobbler-mainnet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseRpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ||
  "https://rpc-endpoints.superfluid.dev/base-mainnet?app=streme-x8fsj6";

const client = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

export async function GET() {
  try {
    const priceWei = await client.readContract({
      address: MAINNET_DUTCH_AUCTION_V2,
      abi: dutchAuctionAbi,
      functionName: "currentPrice",
    });

    return NextResponse.json(
      { priceWei: priceWei.toString() },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("gobbler-current-price", error);
    return NextResponse.json(
      { error: "failed to read gobbler price" },
      { status: 502 },
    );
  }
}
