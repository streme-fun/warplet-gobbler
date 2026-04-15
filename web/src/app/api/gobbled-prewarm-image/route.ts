import { NextRequest, NextResponse } from "next/server";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

function checkPrewarmRateLimit(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitBuckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  existing.count += 1;
  rateLimitBuckets.set(ip, existing);
  return true;
}

/**
 * Best-effort prewarm endpoint for claim image generation.
 * Called by the live auction UI when a lot starts and on each new top bid.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (!checkPrewarmRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      tokenId?: unknown;
      trigger?: unknown;
    };
    const tokenId = Number(body.tokenId);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid tokenId" },
        { status: 400 },
      );
    }

    const trigger =
      typeof body.trigger === "string" && body.trigger.trim()
        ? body.trigger.trim()
        : "unknown";
    const startedAt = Date.now();
    const { url } = await ensureGobbledImage(tokenId);
    const elapsedMs = Date.now() - startedAt;

    console.info("[gobbled-prewarm] ready", { tokenId, trigger, elapsedMs });
    return NextResponse.json({ success: true, tokenId, url, elapsedMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[gobbled-prewarm] failed", { error: message });
    return NextResponse.json(
      { success: false, error: "Could not prewarm gobbled image." },
      { status: 500 },
    );
  }
}
