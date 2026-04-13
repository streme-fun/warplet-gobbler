import { ImageResponse } from "next/og";

/**
 * 1200×1200 branded composite — same asset uploaded to Pinata as the receipt NFT `image`
 * in `/api/mint-gobbled-nft`.
 */
export function createGobbledCompositeImageResponse(
  gobbledBlobUrl: string,
  warpletIdNum: number,
): ImageResponse {
  return new ImageResponse(
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
          src={gobbledBlobUrl}
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
          {`GOBBLED WARPLET #${warpletIdNum}`}
        </div>
      </div>
    ),
    { width: 1200, height: 1200 },
  );
}
