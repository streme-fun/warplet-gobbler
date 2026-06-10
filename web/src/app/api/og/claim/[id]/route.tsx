import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";
import { gobbledArtUrl } from "@/lib/og/gobbled-art";
import {
  ArtPanel,
  fetchImageDataUrl,
  headlineStyle,
  OgFrame,
  OG_COLORS,
  OG_HEIGHT,
  OG_WIDTH,
} from "@/lib/og/theme";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Gobbled art can land after the first share scrape, so cache shorter than
 * the tx-keyed images even on a hit.
 */
const HIT_CACHE = "public, max-age=300, s-maxage=3600";
const MISS_CACHE = "public, max-age=0, s-maxage=60";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const warpletId = Number(params.id);
  if (!Number.isInteger(warpletId) || warpletId <= 0) {
    return new Response("not found", { status: 404 });
  }

  // Prefer the AI "covered in ooze" art; fall back to the original Warplet.
  const oozeUrl = await gobbledArtUrl(warpletId);
  const art = await fetchImageDataUrl(oozeUrl ?? warpletImageSrc(warpletId));

  return new ImageResponse(
    (
      <OgFrame accent="pink" footer="rescued, claimed, never the same again">
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: 56,
          }}
        >
          <ArtPanel
            src={art}
            accent="pink"
            label={`WARPLET #${warpletId}`}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 30,
              flex: 1,
            }}
          >
            <div style={headlineStyle("pink")}>IT SURVIVED.</div>
            <div
              style={{
                display: "flex",
                fontSize: 38,
                color: OG_COLORS.text,
                lineHeight: 1.35,
              }}
            >
              Swallowed by the Gobbler. Auctioned from its gut. Claimed by a
              new keeper.
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "PlexMono",
                fontSize: 30,
                color: OG_COLORS.textDim,
              }}
            >
              GOBBLED WARPLETS · RECEIPT NFT
            </div>
          </div>
        </div>
      </OgFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: ogFonts(),
      headers: { "Cache-Control": oozeUrl ? HIT_CACHE : MISS_CACHE },
    },
  );
}
