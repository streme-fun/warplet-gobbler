import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/miniapp-embed";
import {
  sendGobblerNotification,
  type GobblerNotification,
} from "@/lib/notifications/send";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Internal fan-out endpoint: the activity indexer (or an operator script)
 * POSTs one event here and it becomes Mini App notifications for every
 * subscriber — or for `targetFids` only (e.g. the outbid bidder).
 *
 * Protected by the GOBBLER_NOTIFY_SECRET shared secret; disabled (503) until
 * that env var is set.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GOBBLER_NOTIFY_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "notify endpoint disabled (GOBBLER_NOTIFY_SECRET unset)" },
      { status: 503 },
    );
  }
  if (req.headers.get("x-gobbler-notify-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { notificationId, title, body: text, targetUrl, targetFids } = (body ??
    {}) as {
    notificationId?: unknown;
    title?: unknown;
    body?: unknown;
    targetUrl?: unknown;
    targetFids?: unknown;
  };

  if (
    typeof notificationId !== "string" ||
    notificationId.length === 0 ||
    typeof title !== "string" ||
    title.length === 0 ||
    typeof text !== "string" ||
    text.length === 0
  ) {
    return NextResponse.json(
      { error: "notificationId, title and body are required strings" },
      { status: 400 },
    );
  }

  // targetUrl must stay on our domain — the Farcaster client enforces this
  // too, but failing fast here beats a silently dead notification.
  let safeTargetUrl: string | undefined;
  if (typeof targetUrl === "string" && targetUrl.length > 0) {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.origin !== new URL(appUrl).origin) {
        return NextResponse.json(
          { error: "targetUrl must be on the app domain" },
          { status: 400 },
        );
      }
      safeTargetUrl = parsed.toString();
    } catch {
      return NextResponse.json({ error: "invalid targetUrl" }, { status: 400 });
    }
  }

  let fids: number[] | undefined;
  if (targetFids != null) {
    if (
      !Array.isArray(targetFids) ||
      targetFids.length === 0 ||
      targetFids.length > 1000 ||
      !targetFids.every(
        (f) => typeof f === "number" && Number.isInteger(f) && f > 0,
      )
    ) {
      return NextResponse.json(
        { error: "targetFids must be 1-1000 positive integers" },
        { status: 400 },
      );
    }
    fids = targetFids as number[];
  }

  const notification: GobblerNotification = {
    notificationId,
    title,
    body: text,
    targetUrl: safeTargetUrl,
  };
  const stats = await sendGobblerNotification(notification, fids);

  return NextResponse.json({ ok: true, ...stats });
}
