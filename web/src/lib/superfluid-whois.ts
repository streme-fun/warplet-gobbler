/**
 * Normalize Superfluid Whois API JSON (shape varies slightly by deployment).
 */
export function normalizeSuperfluidWhoisPayload(json: unknown): {
  displayName: string | null;
  avatarUrl: string | null;
} {
  if (!json || typeof json !== "object") {
    return { displayName: null, avatarUrl: null };
  }
  const o = json as Record<string, unknown>;

  const pickString = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const displayName =
    pickString(o.displayName) ??
    pickString(o.name) ??
    pickString(o.username);

  const avatarUrl =
    pickString(o.avatarUrl) ??
    pickString(o.avatar) ??
    pickString(o.image);

  return { displayName, avatarUrl };
}
