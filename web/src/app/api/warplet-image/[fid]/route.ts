import { NextResponse } from "next/server";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export async function GET(
  _request: Request,
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

  return NextResponse.redirect(warpletImageSrc(fid), 307);
}
