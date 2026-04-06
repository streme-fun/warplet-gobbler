import { NextResponse } from "next/server";
import { warpletImageSrc } from "@/lib/warplet-image-src";

/** Optional HTTP entry for Warplet avatars (e.g. `<img src="/api/warplet-image/123">`). The app uses `warpletImageSrc()` directly; redirect target is the fixed Vercel Blob base in `warplet-image-src`. Warplet token ids match Farcaster fids and start at 1. */
export async function GET(
  _request: Request,
  { params }: { params: { fid: string } },
) {
  const raw = params.fid;
  const fid = Number(raw);
  if (
    raw === undefined ||
    !Number.isInteger(fid) ||
    fid < 1 ||
    fid > Number.MAX_SAFE_INTEGER
  ) {
    return NextResponse.json({ error: "invalid fid" }, { status: 400 });
  }

  return NextResponse.redirect(warpletImageSrc(fid), 307);
}
