import { kvConfigured, kvPipeline } from "@/lib/kv";

/**
 * Notification-token store. The Farcaster client issues one (url, token) pair
 * per (client, app, fid) when a user adds the app / enables notifications;
 * the webhook keeps this store in sync and the sender reads it back.
 *
 * Keys: wg:notif:token:<fid> → JSON record, wg:notif:fids → set of fids.
 */

export type NotificationTokenRecord = {
  fid: number;
  url: string;
  token: string;
  updatedAt: number;
};

const tokenKey = (fid: number) => `wg:notif:token:${fid}`;
const FIDS_SET = "wg:notif:fids";

/** Practical broadcast ceiling per send — keeps one /api/notify call bounded. */
const MAX_BROADCAST_FIDS = 10_000;

export const notificationStoreConfigured = () => kvConfigured;

export async function saveNotificationToken(
  fid: number,
  details: { url: string; token: string },
): Promise<boolean> {
  const record: NotificationTokenRecord = {
    fid,
    url: details.url,
    token: details.token,
    updatedAt: Date.now(),
  };
  const res = await kvPipeline([
    ["SET", tokenKey(fid), JSON.stringify(record)],
    ["SADD", FIDS_SET, String(fid)],
  ]);
  return res != null;
}

export async function deleteNotificationToken(fid: number): Promise<boolean> {
  const res = await kvPipeline([
    ["DEL", tokenKey(fid)],
    ["SREM", FIDS_SET, String(fid)],
  ]);
  return res != null;
}

function parseRecord(raw: unknown): NotificationTokenRecord | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationTokenRecord>;
    if (
      typeof parsed.fid !== "number" ||
      typeof parsed.url !== "string" ||
      typeof parsed.token !== "string"
    ) {
      return null;
    }
    return {
      fid: parsed.fid,
      url: parsed.url,
      token: parsed.token,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Token records for specific fids, or every subscriber when `fids` is omitted
 * (broadcast). Unknown fids are silently skipped.
 */
export async function getNotificationTokens(
  fids?: number[],
): Promise<NotificationTokenRecord[]> {
  let targetFids = fids;
  if (!targetFids) {
    const members = await kvPipeline([["SMEMBERS", FIDS_SET]]);
    const raw = members?.[0];
    if (!Array.isArray(raw)) return [];
    targetFids = (raw as string[])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, MAX_BROADCAST_FIDS);
  }
  if (targetFids.length === 0) return [];

  const res = await kvPipeline([
    ["MGET", ...targetFids.map((fid) => tokenKey(fid))],
  ]);
  const values = res?.[0];
  if (!Array.isArray(values)) return [];
  return (values as unknown[])
    .map(parseRecord)
    .filter((r): r is NotificationTokenRecord => r != null);
}
