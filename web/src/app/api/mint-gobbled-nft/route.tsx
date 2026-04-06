import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { uploadToPinata } from "@/app/utils/pinata";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Get gobbled image (generates if missing)
    const { url: gobbledUrl } = await ensureGobbledImage(tokenId);

    // Generate metadata image (1200x1200 square with gobbled warplet + branding)
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "1200px",
            height: "1200px",
            backgroundColor: "#13111C",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gobbledUrl}
            width={900}
            height={900}
            style={{ borderRadius: "40px" }}
            alt=""
          />
          <div
            style={{
              marginTop: "32px",
              fontSize: "48px",
              color: "#00F5FF",
              fontWeight: "bold",
              letterSpacing: "0.1em",
            }}
          >
            {`GOBBLED WARPLET #${tokenId}`}
          </div>
        </div>
      ),
      { width: 1200, height: 1200 },
    );

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageFile = new File(
      [imageArrayBuffer],
      `gobbled-warplet-${tokenId}.png`,
      { type: "image/png" },
    );

    // Upload to Pinata IPFS
    const ipfsLink = await uploadToPinata(imageFile);

    return NextResponse.json({ success: true, ipfsLink, tokenId });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Mint preparation failed",
      },
      { status: 500 },
    );
  }
}
