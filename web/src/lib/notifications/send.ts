import { appUrl } from "@/lib/miniapp-embed";
import {
  deleteNotificationToken,
  getNotificationTokens,
  type NotificationTokenRecord,
} from "@/lib/notifications/store";

/**
 * Batched sender for Farcaster Mini App notifications.
 *
 * Protocol constraints (miniapps.farcaster.xyz/docs/guides/notifications):
 * - POST per client notification URL with up to 100 tokens per call
 * - title ≤32 chars, body ≤128, targetUrl ≤1024 and on the app's domain
 * - notificationId dedupes per (fid, id) for 24h — stable ids are idempotent
 * - per-token rate limit (1 per 30s, 100/day) is enforced client-side by the
 *   Farcaster client; rateLimitedTokens are reported back, not errors
 */

export type GobblerNotification = {
  /** Stable dedupe key, e.g. "gobble:0xabc…". */
  notificationId: string;
  title: string;
  body: string;
  /** Defaults to the app home; must stay on the app's domain. */
  targetUrl?: string;
};

export type SendStats = {
  attempted: number;
  successful: number;
  invalid: number;
  rateLimited: number;
};

const BATCH_SIZE = 100;

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${[...value].slice(0, max - 1).join("")}…`;

type SendResponse = {
  result?: {
    successfulTokens?: string[];
    invalidTokens?: string[];
    rateLimitedTokens?: string[];
  };
};

/**
 * Send to specific fids, or to every subscriber when `fids` is omitted.
 * Invalid tokens (user removed the app out-of-band) are pruned from the store.
 */
export async function sendGobblerNotification(
  notification: GobblerNotification,
  fids?: number[],
): Promise<SendStats> {
  const stats: SendStats = {
    attempted: 0,
    successful: 0,
    invalid: 0,
    rateLimited: 0,
  };

  const records = await getNotificationTokens(fids);
  if (records.length === 0) return stats;

  const payloadBase = {
    notificationId: truncate(notification.notificationId, 128),
    title: truncate(notification.title, 32),
    body: truncate(notification.body, 128),
    targetUrl: notification.targetUrl ?? appUrl,
  };

  // One client (= one notification URL) can serve many fids; group then batch.
  const byUrl = new Map<string, NotificationTokenRecord[]>();
  for (const record of records) {
    const group = byUrl.get(record.url) ?? [];
    group.push(record);
    byUrl.set(record.url, group);
  }

  for (const [url, group] of byUrl) {
    const tokenToFid = new Map(group.map((r) => [r.token, r.fid]));
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      const batch = group.slice(i, i + BATCH_SIZE);
      stats.attempted += batch.length;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...payloadBase,
            tokens: batch.map((r) => r.token),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          console.warn("[notify] batch rejected", { url, status: res.status });
          continue;
        }
        const json = (await res.json()) as SendResponse;
        stats.successful += json.result?.successfulTokens?.length ?? 0;
        stats.rateLimited += json.result?.rateLimitedTokens?.length ?? 0;
        const invalid = json.result?.invalidTokens ?? [];
        stats.invalid += invalid.length;
        for (const token of invalid) {
          const fid = tokenToFid.get(token);
          if (fid != null) void deleteNotificationToken(fid);
        }
      } catch (e) {
        console.warn("[notify] batch failed", { url, error: e });
      }
    }
  }

  return stats;
}
