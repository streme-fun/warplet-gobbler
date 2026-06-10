import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "viem";
import { base } from "viem/chains";
import { baseHttp } from "@/lib/base-http";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { isWarpletInGobblerAuctionCustody } from "@/lib/warplet-gobbled-custody";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const publicClient = createPublicClient({ chain: base, transport: baseHttp() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tokenId = Number(body.tokenId);

    if (!Number.isInteger(tokenId) || tokenId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid tokenId" },
        { status: 400 },
      );
    }

    const ok = await isWarpletInGobblerAuctionCustody(
      publicClient,
      BigInt(tokenId),
    );
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Token not gobbled" },
        { status: 403 },
      );
    }

    const result = await ensureGobbledImage(tokenId);
    return NextResponse.json({ success: true, blobUrl: result.url, tokenId });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not generate image. Try again later." },
      { status: 500 },
    );
  }
}
