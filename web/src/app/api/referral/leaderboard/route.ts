import { NextResponse } from "next/server";
import { kvConfigured, kvCommand } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * The Gobble Gang — top referrers by unique attributed joins. Raw fids so
 * both UI and agents can consume it (enrich display names via Neynar
 * client-side as needed).
 */
export async function GET() {
  if (!kvConfigured) {
    return NextResponse.json(
      { leaderboard: [], stored: false },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }

  const raw = await kvCommand("ZREVRANGE", "wg:ref:lb", 0, 24, "WITHSCORES");
  const flat = Array.isArray(raw) ? (raw as string[]) : [];
  const leaderboard: Array<{ fid: number; invites: number }> = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const fid = Number(flat[i]);
    const invites = Number(flat[i + 1]);
    if (Number.isInteger(fid) && Number.isFinite(invites)) {
      leaderboard.push({ fid, invites });
    }
  }

  return NextResponse.json(
    { leaderboard },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
