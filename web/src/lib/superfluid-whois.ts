/**
 * Superfluid identity resolver — documented shape from
 * https://whois.superfluid.finance/api/resolve/{address}
 */
function pickString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function normalizeHandle(h: string): string {
  const t = h.trim();
  return t.startsWith("@") ? t.slice(1) : t;
}

type ServiceProfile = {
  handle?: string | null;
  avatarUrl?: string | null;
} | null;

function readService(o: unknown): ServiceProfile {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  return {
    handle: pickString(r.handle),
    avatarUrl: pickString(r.avatarUrl),
  };
}

/**
 * Parses JSON from GET https://whois.superfluid.finance/api/resolve/0x…
 */
export function normalizeSuperfluidWhoisPayload(json: unknown): {
  displayName: string | null;
  avatarUrl: string | null;
} {
  if (!json || typeof json !== "object") {
    return { displayName: null, avatarUrl: null };
  }
  const o = json as Record<string, unknown>;

  const ens = readService(o.ENS);
  const fc = readService(o.Farcaster);

  let displayName = pickString(o.recommendedName);
  let avatarUrl = pickString(o.recommendedAvatar);

  if (!displayName) {
    const fh = fc?.handle;
    const eh = ens?.handle;
    const raw = fh ?? eh;
    if (raw) displayName = normalizeHandle(raw);
  }

  if (!avatarUrl) {
    avatarUrl = fc?.avatarUrl ?? ens?.avatarUrl ?? null;
  }

  return { displayName, avatarUrl };
}
