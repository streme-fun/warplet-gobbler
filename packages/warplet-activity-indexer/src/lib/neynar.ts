import { env, neynarEnabled } from "../env.js";

export type NeynarUser = {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
};

export async function getNeynarUserByAddress(address: `0x${string}`): Promise<NeynarUser | null> {
  if (!neynarEnabled) return null;

  const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address/");
  url.searchParams.set("addresses", address.toLowerCase());
  url.searchParams.set("address_types", "custody_address,verified_address");

  const headers: Record<string, string> = {
    accept: "application/json",
    api_key: env.neynarApiKey!,
  };

  if (env.neynarClientId) headers["x-neynar-client-id"] = env.neynarClientId;

  // Timeout so a stalled Neynar call can't hold up the event handler.
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Neynar lookup failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const users = extractUsersForAddress(json, address.toLowerCase());
  const first = users[0];
  if (!first || typeof first !== "object") return null;

  const profile = getObject(first, "profile");
  const bio = getObject(profile, "bio");
  const pfp = getObject(profile, "pfp");

  return {
    fid: getNumber(first, "fid"),
    username: getString(first, "username"),
    displayName: getString(first, "display_name") ?? getString(first, "displayName"),
    pfpUrl: getString(pfp, "url") ?? getString(first, "pfp_url"),
    bio: getString(bio, "text") ?? getString(first, "bio"),
    followerCount: getNumber(first, "follower_count") ?? getNumber(first, "followerCount"),
    followingCount: getNumber(first, "following_count") ?? getNumber(first, "followingCount"),
  };
}

function extractUsersForAddress(json: Record<string, unknown>, address: string): unknown[] {
  const result = getObject(json, "result");
  const byAddress = getObject(result, "address") ?? getObject(json, "address") ?? getObject(json, "resultByAddress");
  if (byAddress && Array.isArray((byAddress as Record<string, unknown>)[address])) {
    return Array.from(((byAddress as Record<string, unknown>)[address] as readonly unknown[]) ?? []);
  }

  const users = getArray(result, "users") ?? getArray(json, "users");
  return users ? Array.from(users) : [];
}

function getObject(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" ? (child as Record<string, unknown>) : undefined;
}

function getArray(value: unknown, key: string): readonly unknown[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const child = (value as Record<string, unknown>)[key];
  return Array.isArray(child) ? child : undefined;
}

function getString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const child = (value as Record<string, unknown>)[key];
  return typeof child === "string" ? child : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const child = (value as Record<string, unknown>)[key];
  return typeof child === "number" ? child : undefined;
}
