import type { Address } from "viem";

type NeynarUserRow = {
  username?: string;
  display_name?: string | null;
  pfp_url?: string | null;
  custody_address?: string;
  verifications?: string[];
};

function extractUserRows(json: unknown, checksum: string): NeynarUserRow[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  if (
    root.result &&
    typeof root.result === "object" &&
    !Array.isArray(root.result)
  ) {
    const inner = extractUserRows(root.result, checksum);
    if (inner.length) return inner;
  }
  const checksumLc = checksum.toLowerCase();

  const asRows = (v: unknown): NeynarUserRow[] =>
    Array.isArray(v)
      ? v.filter((x) => x && typeof x === "object") as NeynarUserRow[]
      : [];

  const directCs = asRows(root[checksum]);
  if (directCs.length) return directCs;
  const directLc = asRows(root[checksumLc]);
  if (directLc.length) return directLc;

  if (Array.isArray(root.users)) return asRows(root.users);

  for (const [k, v] of Object.entries(root)) {
    if (!/^0x[a-fA-F0-9]{40}$/i.test(k)) continue;
    if (k.toLowerCase() !== checksumLc) continue;
    const rows = asRows(v);
    if (rows.length) return rows;
  }

  const fallback: NeynarUserRow[] = [];
  for (const [k, v] of Object.entries(root)) {
    if (k === "next" || k === "code" || k === "message" || k === "users")
      continue;
    fallback.push(...asRows(v));
  }
  return fallback;
}

function pickUserForAddress(
  rows: NeynarUserRow[],
  checksumLc: string,
): NeynarUserRow | null {
  if (rows.length === 0) return null;
  const match = rows.find(
    (u) =>
      u.custody_address?.toLowerCase() === checksumLc ||
      u.verifications?.some((a) => a.toLowerCase() === checksumLc),
  );
  return match ?? rows[0] ?? null;
}

/**
 * Resolve Farcaster display + pfp via Neynar (custody + verified Ethereum addresses).
 * Requires `NEYNAR_API_KEY` in the server environment.
 */
export async function tryNeynarBidderProfile(
  checksum: Address,
): Promise<{ displayName: string; avatarUrl: string | null } | null> {
  const key = process.env.NEYNAR_API_KEY?.trim();
  if (!key) return null;

  const url = new URL(
    "https://api.neynar.com/v2/farcaster/user/bulk-by-address/",
  );
  url.searchParams.set("addresses", checksum);

  const res = await fetch(url, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const rows = extractUserRows(json, checksum);
  const checksumLc = checksum.toLowerCase();
  const u = pickUserForAddress(rows, checksumLc);
  if (!u) return null;

  const username =
    typeof u.username === "string" ? u.username.trim() : "";
  const display =
    (typeof u.display_name === "string" && u.display_name.trim()) ||
    (username ? `@${username}` : "");
  const avatarUrl =
    typeof u.pfp_url === "string" && u.pfp_url.trim()
      ? u.pfp_url.trim()
      : null;

  if (!display && !avatarUrl) return null;
  return {
    displayName: display || (username ? `@${username}` : checksum),
    avatarUrl,
  };
}

