import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";
import {
  deleteNotificationToken,
  notificationStoreConfigured,
  saveNotificationToken,
} from "@/lib/notifications/store";

export const runtime = "nodejs";

/**
 * Farcaster Mini App lifecycle webhook (registered in farcaster.json).
 * Signature-verified: the payload is a JSON Farcaster Signature whose app key
 * must belong to the signing fid — `verifyAppKeyWithNeynar` checks that via
 * Neynar (requires NEYNAR_API_KEY).
 *
 * miniapp_added / notifications_enabled hand us the (url, token) pair that
 * powers pot alerts; the mirror events revoke it.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!process.env.NEYNAR_API_KEY?.trim()) {
    console.error(
      "[webhook] NEYNAR_API_KEY unset — cannot verify webhook signatures",
    );
    return NextResponse.json(
      { error: "webhook verification unavailable" },
      { status: 503 },
    );
  }

  let data: Awaited<ReturnType<typeof parseWebhookEvent>>;
  try {
    data = await parseWebhookEvent(body, verifyAppKeyWithNeynar);
  } catch (e) {
    console.warn("[webhook] rejected payload", e);
    return NextResponse.json({ error: "invalid payload" }, { status: 401 });
  }

  const fid = data.fid;
  const event = data.event;

  if (!notificationStoreConfigured()) {
    // Accept (200) so the client doesn't retry forever, but tell the operator.
    console.warn(
      "[webhook] notification store unconfigured — token dropped",
      { fid, event: event.event },
    );
    return NextResponse.json({ success: true, stored: false });
  }

  switch (event.event) {
    case "miniapp_added":
    case "notifications_enabled": {
      const details = event.notificationDetails;
      // https-only: the stored URL becomes a server-side POST target in
      // sendGobblerNotification — defense-in-depth against SSRF should the
      // signature check ever be bypassed.
      if (details && details.url.startsWith("https://")) {
        await saveNotificationToken(fid, {
          url: details.url,
          token: details.token,
        });
      } else if (details) {
        console.warn("[webhook] rejected non-https notification url", { fid });
      }
      break;
    }
    case "miniapp_removed":
    case "notifications_disabled":
      await deleteNotificationToken(fid);
      break;
  }

  return NextResponse.json({ success: true });
}
