"use client";

import { useEffect } from "react";
import { useMiniApp } from "@/hooks/useMiniApp";

const REF_KEY = "warpletgobbler:ref";
const REF_REPORTED_KEY = "warpletgobbler:ref-reported";

export type StoredReferral = { fid: number; via: string | null; at: number };

export function readStoredReferral(): StoredReferral | null {
  try {
    const raw = window.localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof parsed.fid !== "number" || !Number.isInteger(parsed.fid)) {
      return null;
    }
    return {
      fid: parsed.fid,
      via: typeof parsed.via === "string" ? parsed.via : null,
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

/**
 * First-touch referral attribution. Share URLs land here with `?ref=<fid>`
 * (the bragger) and `?via=<surface>`; the first ref a device ever sees wins
 * and is reported once to `/api/referral` so the Gobble Gang leaderboard can
 * credit the bragger. Storage-less environments just skip attribution.
 */
export function useReferralCapture() {
  const { isLoaded, context } = useMiniApp();
  const viewerFid = context?.user?.fid ?? null;

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    let ref: number | null = null;
    let via: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const rawRef = params.get("ref");
      if (rawRef && /^\d{1,12}$/.test(rawRef)) ref = Number(rawRef);
      const rawVia = params.get("via");
      if (rawVia && /^[a-z0-9_-]{1,16}$/i.test(rawVia)) via = rawVia;
    } catch {
      return;
    }
    if (ref == null) return;
    // Self-referrals don't count.
    if (viewerFid != null && viewerFid === ref) return;

    try {
      if (!window.localStorage.getItem(REF_KEY)) {
        const stored: StoredReferral = { fid: ref, via, at: Date.now() };
        window.localStorage.setItem(REF_KEY, JSON.stringify(stored));
      }
      if (window.localStorage.getItem(REF_REPORTED_KEY)) return;
      window.localStorage.setItem(REF_REPORTED_KEY, "1");
    } catch {
      return;
    }

    void fetch("/api/referral", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ref,
        via,
        viewerFid,
      }),
    }).catch(() => {
      /* attribution is best-effort */
    });
  }, [isLoaded, viewerFid]);
}
