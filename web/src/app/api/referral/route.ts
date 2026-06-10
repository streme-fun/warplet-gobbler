import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, kvPipeline } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * First-touch referral attribution. Clients report at most once per device
 * (localStorage-gated); the joined-set dedupes again server-side per
 * (referrer, viewer) so refresh spam can't farm the leaderboard.
 *
 * Keys: wg:ref:joined:<fid> (set of viewer keys), wg:ref:lb (zset fid→unique
 * joins), wg:ref:via (hash of share-surface counters).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { ref, via, viewerFid } = (body ?? {}) as {
    ref?: unknown;
    via?: unknown;
    viewerFid?: unknown;
  };

  if (
    typeof ref !== "number" ||
    !Number.isInteger(ref) ||
    ref <= 0 ||
    ref > 1e12
  ) {
    return NextResponse.json({ error: "invalid ref" }, { status: 400 });
  }
  const viaKey =
    typeof via === "string" && /^[a-z0-9_-]{1,16}$/i.test(via) ? via : "other";
  const viewerKey =
    typeof viewerFid === "number" &&
    Number.isInteger(viewerFid) &&
    viewerFid > 0 &&
    viewerFid <= 1e12
      ? `fid:${viewerFid}`
      : `anon:${crypto.randomUUID()}`;

  if (viewerKey === `fid:${ref}`) {
    return NextResponse.json({ ok: true, counted: false });
  }

  if (!kvConfigured) {
    return NextResponse.json({ ok: true, counted: false, stored: false });
  }

  const first = await kvPipeline([
    ["SADD", `wg:ref:joined:${ref}`, viewerKey],
    ["HINCRBY", "wg:ref:via", viaKey, 1],
  ]);
  const isNewJoin = first?.[0] === 1;
  if (isNewJoin) {
    await kvPipeline([["ZINCRBY", "wg:ref:lb", 1, String(ref)]]);
  }

  return NextResponse.json({ ok: true, counted: isNewJoin });
}
