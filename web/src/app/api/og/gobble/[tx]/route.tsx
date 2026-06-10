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
  lookupGobbleByTx,
  readPayoutTokenMeta,
} from "@/lib/share/onchain-events";
import { PAYMENT_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Receipts are immutable — cache hard. Fallback caches short so it heals. */
const HIT_CACHE = "public, max-age=300, s-maxage=86400, immutable";
const MISS_CACHE = "public, max-age=0, s-maxage=60";

function fallbackImage() {
  return new ImageResponse(
    (
      <OgFrame accent="cyan" footer="a Warplet went in. the pot went out.">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            gap: 28,
          }}
        >
          <div style={headlineStyle("cyan", 130)}>THE GOBBLER FEEDS</div>
          <div style={{ display: "flex", fontSize: 34, color: OG_COLORS.textDim }}>
            this gobble is still being digested…
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
  const gobble = await lookupGobbleByTx(params.tx);
  if (!gobble) return fallbackImage();

  const [identity, tokenMeta, art] = await Promise.all([
    resolveShareIdentity(gobble.seller),
    readPayoutTokenMeta(PAYMENT_TOKEN_SYMBOL),
    fetchImageDataUrl(warpletImageSrc(gobble.tokenId)),
  ]);
  const avatar = await fetchImageDataUrl(identity.avatarUrl, 2500);
  const amountLabel = formatCompactWei(gobble.payoutWei, tokenMeta.decimals);

  return new ImageResponse(
    (
      <OgFrame accent="cyan" footer="the pot is already refilling →">
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
            accent="cyan"
            label={`WARPLET #${gobble.tokenId}`}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 34,
              flex: 1,
            }}
          >
            <div style={headlineStyle("cyan")}>GOBBLED.</div>
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
                drained from the pot in one gulp
              </div>
            </div>
            <IdentityRow
              avatarUrl={avatar}
              prefix="fed to the Gobbler by"
              name={identity.displayName}
              accent="cyan"
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
