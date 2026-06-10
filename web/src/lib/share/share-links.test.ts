import { describe, it, expect } from "vitest";
import { appUrl } from "@/lib/miniapp-embed";
import {
  bidCastText,
  claimShareUrl,
  composeIntentUrl,
  gobbleCastText,
  gobbleShareUrl,
  potShareBucket,
  potShareUrl,
  winShareUrl,
} from "./share-links";

const TX = `0x${"ab".repeat(32)}`;

describe("share URLs", () => {
  it("builds a gobble share URL keyed by tx hash with the referrer fid", () => {
    expect(gobbleShareUrl(TX, { ref: 446697 })).toBe(
      `${appUrl}/g/${TX}?ref=446697`,
    );
  });

  it("lowercases mixed-case tx hashes so cast URLs are canonical", () => {
    const mixed = `0x${"AB".repeat(32)}`;
    expect(winShareUrl(mixed)).toBe(`${appUrl}/w/${TX}`);
  });

  it("rejects malformed tx hashes instead of emitting broken embeds", () => {
    expect(() => gobbleShareUrl("0x1234")).toThrow(/invalid tx hash/);
    expect(() => winShareUrl("not-a-hash")).toThrow(/invalid tx hash/);
  });

  it("omits ref when the viewer has no fid", () => {
    expect(claimShareUrl(123)).toBe(`${appUrl}/c/123`);
    expect(claimShareUrl(123, { ref: null })).toBe(`${appUrl}/c/123`);
  });

  it("rejects non-positive warplet ids", () => {
    expect(() => claimShareUrl(0)).toThrow(/invalid warplet id/);
    expect(() => claimShareUrl(1.5)).toThrow(/invalid warplet id/);
  });

  it("pot URLs carry a 10-minute bucket so each share window re-scrapes", () => {
    // Buckets are epoch-aligned 10-minute windows.
    const windowStartMs = 2_833_333 * 600_000;
    const bucket = potShareBucket(windowStartMs);
    expect(bucket).toBe(2_833_333);
    expect(potShareUrl({ ref: 7, nowMs: windowStartMs })).toBe(
      `${appUrl}/pot?ref=7&t=${bucket}`,
    );
    // Same window → same URL (dedupes); next window → new URL.
    expect(potShareBucket(windowStartMs + 599_999)).toBe(bucket);
    expect(potShareBucket(windowStartMs + 600_000)).toBe(bucket + 1);
  });
});

describe("composeIntentUrl", () => {
  it("targets the farcaster.xyz composer with text and embeds", () => {
    const url = new URL(
      composeIntentUrl({ text: "gobble 🦷", embeds: [`${appUrl}/g/${TX}`] }),
    );
    expect(url.origin + url.pathname).toBe("https://farcaster.xyz/~/compose");
    expect(url.searchParams.get("text")).toBe("gobble 🦷");
    expect(url.searchParams.getAll("embeds[]")).toEqual([`${appUrl}/g/${TX}`]);
  });

  it("caps embeds at two (Farcaster's limit)", () => {
    const url = new URL(
      composeIntentUrl({ text: "x", embeds: ["https://a", "https://b", "https://c"] }),
    );
    expect(url.searchParams.getAll("embeds[]")).toHaveLength(2);
  });
});

describe("cast copy", () => {
  it("gobble brag includes the warplet, the haul, and the symbol", () => {
    const text = gobbleCastText({
      tokenId: 481,
      amountLabel: "2.41M",
      symbol: "WARPGOBB",
    });
    expect(text).toContain("#481");
    expect(text).toContain("2.41M $WARPGOBB");
    expect(text.length).toBeLessThan(280);
  });

  it("bid taunt invites a counter-bid", () => {
    const text = bidCastText({
      tokenId: 99,
      amountLabel: "0.42",
      symbol: "STREME",
    });
    expect(text).toContain("#99");
    expect(text).toMatch(/outbid/i);
  });
});
