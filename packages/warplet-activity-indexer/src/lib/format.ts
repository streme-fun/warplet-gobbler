import type { NeynarUser } from "./neynar.js";
import { escapeTelegramHtml } from "./telegram-notifier.js";

export const escapeHtml = escapeTelegramHtml;

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTokenAmount(value: bigint | null | undefined, decimals = 18): string {
  if (value == null) return "0";
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const frac = fraction.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 4);
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function formatActor(address: string | null | undefined, profile?: NeynarUser | null): string {
  if (!address) return "unknown";
  const bits: string[] = [];
  if (profile?.displayName) bits.push(escapeHtml(profile.displayName));
  if (profile?.username) bits.push(`@${escapeHtml(profile.username)}`);
  bits.push(`<code>${shortAddress(address)}</code>`);
  return bits.join(" · ");
}

// Plain-text actor label (no HTML) for Farcaster notification copy.
export function formatActorPlain(
  address: string | null | undefined,
  profile?: NeynarUser | null,
): string {
  if (!address) return "Someone";
  if (profile?.displayName) return profile.displayName;
  if (profile?.username) return `@${profile.username}`;
  return shortAddress(address);
}
