import { NextResponse } from "next/server";
import { getCachedWarpletImage } from "@/lib/warplet-image-cache";

export const runtime = "nodejs";

function placeholderRedirect(request: Request) {
  const u = new URL(request.url);
  return NextResponse.redirect(new URL("/warplet.png", u.origin), 307);
}

export async function GET(
  request: Request,
  { params }: { params: { fid: string } },
) {
  const raw = params.fid;
  const fid = Number(raw);
  if (
    raw === undefined ||
    !Number.isInteger(fid) ||
    fid < 0 ||
    fid > Number.MAX_SAFE_INTEGER
  ) {
    return NextResponse.json({ error: "invalid fid" }, { status: 400 });
  }

  try {
    const { base64, contentType } = await getCachedWarpletImage(fid);
    const bytes = Buffer.from(base64, "base64");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return placeholderRedirect(request);
  }
}
