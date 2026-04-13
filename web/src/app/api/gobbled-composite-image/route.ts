import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { createGobbledCompositeImageResponse } from "@/lib/gobbled-composite-og";
import { isWarpletInGobblerAuctionCustody } from "@/lib/warplet-gobbled-custody";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const publicClient = createPublicClient({ chain: base, transport: http() });

async function compositePngForToken(tokenId: number): Promise<ArrayBuffer> {
  const { url: gobbledBlobUrl } = await ensureGobbledImage(tokenId);
  const imageResponse = createGobbledCompositeImageResponse(
    gobbledBlobUrl,
    tokenId,
  );
  return imageResponse.arrayBuffer();
}

/**
 * Same 1200×1200 branded PNG bytes that `/api/mint-gobbled-nft` uploads to Pinata as `image`.
 * Served directly to avoid duplicate IPFS uploads on every rescue-screen view.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("tokenId");
    const tokenId = raw != null ? Number(raw) : NaN;
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

    const png = await compositePngForToken(tokenId);
    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not build composite image." },
      { status: 500 },
    );
  }
}

/** POST body `{ tokenId }` — same PNG as GET (for clients that prefer fetch + blob checks). */
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

    const png = await compositePngForToken(tokenId);
    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not build composite image." },
      { status: 500 },
    );
  }
}
