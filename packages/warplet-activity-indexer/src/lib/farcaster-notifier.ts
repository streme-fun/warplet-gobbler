import { env, farcasterNotifyEnabled } from "../env.js";

// Hard limits enforced by the web app's notify endpoint.
const NOTIFICATION_ID_MAX_LENGTH = 128;
const TITLE_MAX_LENGTH = 32;
const BODY_MAX_LENGTH = 128;

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

export type FarcasterNotificationPayload = {
  /** Stable dedupe key (<=128 chars) — the endpoint drops repeats. */
  notificationId: string;
  title: string;
  body: string;
  /** Absolute URL on the app domain; omit to open the app home. */
  targetUrl?: string;
  /** Specific subscriber fids; omit to broadcast to all subscribers. */
  targetFids?: number[];
};

export type FarcasterNotificationResult = {
  outcome: "sent" | "skipped" | "failed";
};

if (!farcasterNotifyEnabled) {
  console.log(
    "[warplet-activity-indexer] Farcaster Mini App notifications disabled (set GOBBLER_NOTIFY_URL and GOBBLER_NOTIFY_SECRET to enable)",
  );
}

export function truncateNotificationText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  // Accumulate whole code points until the UTF-16 budget (minus the ellipsis)
  // is spent — an emoji surrogate pair is kept or dropped atomically.
  const budget = maxLength - 1;
  let out = "";
  for (const point of value) {
    if (out.length + point.length > budget) break;
    out += point;
  }
  return `${out}…`;
}

export async function sendFarcasterNotification(
  payload: FarcasterNotificationPayload,
): Promise<FarcasterNotificationResult> {
  if (!farcasterNotifyEnabled) return { outcome: "skipped" };

  const body = JSON.stringify({
    notificationId: payload.notificationId.slice(0, NOTIFICATION_ID_MAX_LENGTH),
    title: truncateNotificationText(payload.title, TITLE_MAX_LENGTH),
    body: truncateNotificationText(payload.body, BODY_MAX_LENGTH),
    ...(payload.targetUrl ? { targetUrl: payload.targetUrl } : {}),
    ...(payload.targetFids && payload.targetFids.length > 0
      ? { targetFids: payload.targetFids }
      : {}),
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Timeout so a stalled endpoint can't hold up the event handler.
      const response = await fetch(env.gobblerNotifyUrl!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gobbler-notify-secret": env.gobblerNotifySecret!,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) return { outcome: "sent" };

      const text = await response.text().catch(() => "");
      const detail = `(${response.status}): ${text.slice(0, 200)}`;
      // 5xx may be transient — retry once. 4xx is a hard failure.
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        console.warn(
          `[warplet-activity-indexer] Farcaster notify ${payload.notificationId} got ${detail}, retrying`,
        );
        continue;
      }
      console.error(
        `[warplet-activity-indexer] Farcaster notify failed for ${payload.notificationId} ${detail}`,
      );
      return { outcome: "failed" };
    } catch (error) {
      // Network error / timeout — retry once, then give up without throwing.
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `[warplet-activity-indexer] Farcaster notify ${payload.notificationId} errored, retrying`,
          error,
        );
        continue;
      }
      console.error(
        `[warplet-activity-indexer] Farcaster notify failed for ${payload.notificationId}`,
        error,
      );
      return { outcome: "failed" };
    }
  }

  return { outcome: "failed" };
}
