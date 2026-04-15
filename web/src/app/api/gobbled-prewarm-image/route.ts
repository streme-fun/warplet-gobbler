import { NextRequest, NextResponse } from "next/server";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const PREWARM_SECRET_HEADER = "x-prewarm-secret";

/**
 * Best-effort prewarm endpoint for claim image generation.
 * Called by the live auction UI when a lot starts and on each new top bid.
 */
export async function POST(request: NextRequest) {
  try {
    const configuredSecret = process.env.GOBBLED_PREWARM_SECRET;
    if (!configuredSecret) {
      console.warn("[gobbled-prewarm] missing GOBBLED_PREWARM_SECRET");
      return NextResponse.json(
        { success: false, error: "Prewarm endpoint is unavailable." },
        { status: 503 },
      );
    }
    const providedSecret = request.headers.get(PREWARM_SECRET_HEADER);
    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized prewarm request." },
        { status: 401 },
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
