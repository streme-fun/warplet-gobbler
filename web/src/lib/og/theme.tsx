/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";

/**
 * Shared visual system for the share-embed images rendered with satori
 * (next/og). Everything here must stick to satori-supported CSS: flex layout,
 * gradients, borders, border-radius, absolute positioning. No filters, no
 * text-shadow, no grid.
 *
 * Canvas is 1200×800 (the 3:2 ratio Farcaster Mini App embeds require).
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 800;

export const OG_COLORS = {
  bg: "#0D0A16",
  bgPanel: "#13111C",
  text: "#F4F1FF",
  textDim: "rgba(244, 241, 255, 0.55)",
  textFaint: "rgba(244, 241, 255, 0.35)",
  cyan: "#00F5FF",
  purple: "#7B61FF",
  pink: "#FF007A",
} as const;

export type OgAccent = "cyan" | "purple" | "pink";

const ACCENT_HEX: Record<OgAccent, string> = {
  cyan: OG_COLORS.cyan,
  purple: OG_COLORS.purple,
  pink: OG_COLORS.pink,
};

export const accentHex = (accent: OgAccent) => ACCENT_HEX[accent];

/** Row of jaw teeth — the Gobbler's visual signature on every embed. */
export function TeethStrip({
  accent,
  edge,
}: {
  accent: OgAccent;
  edge: "top" | "bottom";
}) {
  const color = accentHex(accent);
  const teeth = Array.from({ length: 24 });
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 0,
        right: 0,
        [edge]: 0,
        justifyContent: "space-between",
        padding: "0 8px",
        opacity: 0.9,
      }}
    >
      {teeth.map((_, i) => (
        <div
          key={i}
          style={{
            width: 0,
            height: 0,
            borderLeft: "22px solid transparent",
            borderRight: "22px solid transparent",
            ...(edge === "top"
              ? { borderTop: `26px solid ${color}` }
              : { borderBottom: `26px solid ${color}` }),
          }}
        />
      ))}
    </div>
  );
}

/** Full-bleed frame: abyss background, accent glows, jaws, watermark footer. */
export function OgFrame({
  accent,
  footer,
  children,
}: {
  accent: OgAccent;
  footer: string;
  children: ReactNode;
}) {
  const color = accentHex(accent);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG_COLORS.bg,
        backgroundImage: `radial-gradient(circle at 18% 12%, ${color}26 0%, transparent 52%), radial-gradient(circle at 85% 88%, ${color}1f 0%, transparent 48%), linear-gradient(180deg, #161126 0%, ${OG_COLORS.bg} 70%)`,
        position: "relative",
        fontFamily: "Poppins",
        color: OG_COLORS.text,
      }}
    >
      <TeethStrip accent={accent} edge="top" />
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: "70px 64px 56px",
          alignItems: "center",
        }}
      >
        {children}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px 44px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: OG_COLORS.textDim,
            letterSpacing: 1,
          }}
        >
          {footer}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color,
            letterSpacing: 4,
          }}
        >
          WARPLETGOBBLER.XYZ
        </div>
      </div>
      <TeethStrip accent={accent} edge="bottom" />
    </div>
  );
}

/** Square art panel with an accent ring; falls back to a void tile. */
export function ArtPanel({
  src,
  accent,
  size = 420,
  label,
}: {
  src: string | null;
  accent: OgAccent;
  size?: number;
  label?: string;
}) {
  const color = accentHex(accent);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: 36,
          border: `6px solid ${color}`,
          backgroundColor: OG_COLORS.bgPanel,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          <img
            src={src}
            width={size}
            height={size}
            style={{ objectFit: "cover" }}
            alt=""
          />
        ) : (
          <div style={{ display: "flex", fontSize: 160 }}>🦷</div>
        )}
      </div>
      {label ? (
        <div
          style={{
            display: "flex",
            fontFamily: "PlexMono",
            fontSize: 30,
            color: OG_COLORS.textDim,
            letterSpacing: 2,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

/** Stacked identity block: dim prefix label, then avatar + display name. */
export function IdentityRow({
  avatarUrl,
  prefix,
  name,
  accent,
}: {
  avatarUrl: string | null;
  prefix: string;
  name: string;
  accent: OgAccent;
}) {
  const color = accentHex(accent);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          color: OG_COLORS.textDim,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {prefix}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            width={64}
            height={64}
            style={{
              borderRadius: 64,
              border: `3px solid ${color}`,
              objectFit: "cover",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 64,
              border: `3px solid ${color}`,
              backgroundColor: OG_COLORS.bgPanel,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            👤
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 38,
            color: OG_COLORS.text,
            maxWidth: 480,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
}

export const headlineStyle = (
  accent: OgAccent,
  size = 118,
): CSSProperties => ({
  display: "flex",
  fontFamily: "Creepster",
  fontSize: size,
  lineHeight: 0.95,
  color: accentHex(accent),
});

export const amountStyle = (size = 64): CSSProperties => ({
  display: "flex",
  fontFamily: "PlexMono",
  fontSize: size,
  color: OG_COLORS.text,
});

/**
 * MIME from magic bytes — upstream CDNs lie (e.g. the Warplet store serves
 * JPEG bytes under .png names), and a wrong data-URL MIME makes the satori
 * rasterizer render a black box instead of the image.
 */
function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  return null;
}

/**
 * Fetch a remote image and inline it as a data URL so satori never has to do
 * its own (failure-prone) fetching. Returns null on any failure — callers
 * render a fallback tile instead of erroring the whole image.
 */
export async function fetchImageDataUrl(
  url: string | null,
  timeoutMs = 4000,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = sniffImageMime(buf);
    if (!contentType) return null;
    // 8MB guard — satori embeds the bytes into the render.
    if (buf.byteLength > 8 * 1024 * 1024) return null;
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}
