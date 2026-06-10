import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";
import {
  headlineStyle,
  amountStyle,
  OgFrame,
  OG_COLORS,
  OG_HEIGHT,
  OG_WIDTH,
} from "@/lib/og/theme";
import { formatCompactWei } from "@/lib/share/format-amount";
import {
  readPayoutTokenMeta,
  readPotWei,
} from "@/lib/share/onchain-events";
import { PAYMENT_TOKEN_SYMBOL } from "@/lib/paymentToken";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The pot is live data; share URLs carry a 10-minute bucket so each share
 * window gets a fresh scrape. Keep the CDN copy short-lived to match.
 */
const CACHE = "public, max-age=0, s-maxage=120, stale-while-revalidate=600";

export async function GET() {
  const [potWei, tokenMeta] = await Promise.all([
    readPotWei(),
    readPayoutTokenMeta(PAYMENT_TOKEN_SYMBOL),
  ]);
  const amountLabel =
    potWei != null ? formatCompactWei(potWei, tokenMeta.decimals) : "???";

  return new ImageResponse(
    (
      <OgFrame accent="cyan" footer="one Warplet in. everything out.">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            gap: 30,
          }}
        >
          <div style={headlineStyle("cyan", 100)}>THE POT IS FATTENING</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={amountStyle(150)}>{amountLabel}</div>
            <div
              style={{
                display: "flex",
                fontFamily: "PlexMono",
                fontSize: 48,
                color: OG_COLORS.textDim,
              }}
            >
              ${tokenMeta.symbol}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: OG_COLORS.textDim,
            }}
          >
            streaming in every second — first Warplet in takes it all
          </div>
        </div>
      </OgFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: ogFonts(),
      headers: { "Cache-Control": CACHE },
    },
  );
}
