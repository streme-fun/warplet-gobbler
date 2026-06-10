import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";
import {
  ArtPanel,
  fetchImageDataUrl,
  headlineStyle,
  amountStyle,
  IdentityRow,
  OgFrame,
  OG_COLORS,
  OG_HEIGHT,
  OG_WIDTH,
} from "@/lib/og/theme";
import { formatCompactWei } from "@/lib/share/format-amount";
import { resolveShareIdentity } from "@/lib/share/identity";
import {
  lookupSettleByTx,
  readBidTokenMeta,
} from "@/lib/share/onchain-events";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export const runtime = "nodejs";
export const maxDuration = 30;

const HIT_CACHE = "public, max-age=300, s-maxage=86400, immutable";
const MISS_CACHE = "public, max-age=0, s-maxage=60";

function fallbackImage() {
  return new ImageResponse(
    (
      <OgFrame accent="purple" footer="every gobbled Warplet gets auctioned">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            gap: 28,
          }}
        >
          <div style={headlineStyle("purple", 120)}>THE AUCTION BLOCK</div>
          <div style={{ display: "flex", fontSize: 34, color: OG_COLORS.textDim }}>
            this settlement is still being counted…
          </div>
        </div>
      </OgFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: ogFonts(),
      headers: { "Cache-Control": MISS_CACHE },
    },
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { tx: string } },
) {
  const settle = await lookupSettleByTx(params.tx);
  if (!settle) return fallbackImage();

  const [identity, tokenMeta, art] = await Promise.all([
    resolveShareIdentity(settle.winner),
    readBidTokenMeta(AUCTION_BID_TOKEN_SYMBOL),
    fetchImageDataUrl(warpletImageSrc(settle.tokenId)),
  ]);
  const avatar = await fetchImageDataUrl(identity.avatarUrl, 2500);
  const amountLabel = formatCompactWei(settle.amountWei, tokenMeta.decimals);

  return new ImageResponse(
    (
      <OgFrame accent="purple" footer="watch the next lot before it's gone →">
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
            accent="purple"
            label={`WARPLET #${settle.tokenId}`}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 34,
              flex: 1,
            }}
          >
            <div style={headlineStyle("purple")}>RESCUED.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={amountStyle(92)}>{amountLabel}</div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "PlexMono",
                    fontSize: 42,
                    color: OG_COLORS.textDim,
                  }}
                >
                  ${tokenMeta.symbol}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  color: OG_COLORS.textDim,
                }}
              >
                winning bid at the gut auction
              </div>
            </div>
            <IdentityRow
              avatarUrl={avatar}
              prefix="pulled from the gut by"
              name={identity.displayName}
              accent="purple"
            />
          </div>
        </div>
      </OgFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: ogFonts(),
      headers: { "Cache-Control": HIT_CACHE },
    },
  );
}
