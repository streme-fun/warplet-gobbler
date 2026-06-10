import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "viem";
import { base } from "viem/chains";
import { baseHttp } from "@/lib/base-http";
import {
  ensureGobbledImage,
  gobbledBlobExists,
} from "@/lib/generate-gobbled-image";
import { isWarpletInGobblerAuctionCustody } from "@/lib/warplet-gobbled-custody";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const publicClient = createPublicClient({ chain: base, transport: baseHttp() });

async function authorizeAndResolveBlobUrl(
  tokenId: number,
): Promise<
  { ok: true; url: string } | { ok: false; status: number; error: string }
> {
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    return { ok: false, status: 400, error: "Invalid tokenId" };
  }
  const [inCustody, hasStoredGobbled] = await Promise.all([
    isWarpletInGobblerAuctionCustody(publicClient, BigInt(tokenId)),
    gobbledBlobExists(tokenId),
  ]);
  // Allow after the NFT leaves auction escrow (e.g. winner wallet) if we already have the gobbled asset.
  if (!inCustody && !hasStoredGobbled) {
    return { ok: false, status: 403, error: "Token not gobbled" };
  }
  const { url } = await ensureGobbledImage(tokenId);
  return { ok: true, url };
}

/**
 * Returns the raw gobbled PNG (no frame, no label) by redirecting to the Vercel Blob URL.
 * The custody check still runs server-side so we don't expose blobs for tokens that
 * haven't actually been gobbled.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("tokenId");
    const tokenId = raw != null ? Number(raw) : NaN;
    const result = await authorizeAndResolveBlobUrl(tokenId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.redirect(result.url, 302);
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not resolve gobbled image." },
      { status: 500 },
    );
  }
}

/** POST body `{ tokenId }` — same redirect as GET (for clients that prefer fetch + blob checks). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tokenId = Number(body.tokenId);
    const result = await authorizeAndResolveBlobUrl(tokenId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.redirect(result.url, 302);
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not resolve gobbled image." },
      { status: 500 },
    );
  }
}
