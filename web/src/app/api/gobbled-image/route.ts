import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const publicClient = createPublicClient({ chain: base, transport: http() });

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

    // Verify on-chain: tokenId must be owned by nftReserve (i.e., actually gobbled)
    const owner = await publicClient.readContract({
      address: CONTRACTS.warplets,
      abi: [
        {
          name: "ownerOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ type: "uint256", name: "tokenId" }],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });

    const nftReserve = await publicClient.readContract({
      address: CONTRACTS.dutchAuction,
      abi: [
        {
          name: "nftReserve",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "nftReserve",
    });

    if (owner !== nftReserve) {
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
