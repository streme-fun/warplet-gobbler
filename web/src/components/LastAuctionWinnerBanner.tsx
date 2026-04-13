"use client";

/* eslint-disable @next/next/no-img-element */

import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import AuctionWarpletImage from "./AuctionWarpletImage";
import BidderAvatarName from "./BidderAvatarName";
import type { RescueStage } from "@/hooks/useGobbledRescue";

/** @deprecated legacy single-dismiss key — migrated to {@link DISMISSED_FPS_KEY} */
const LEGACY_DISMISSED_FP_KEY = "wg:last-auction-winner-dismissed";
/** @deprecated legacy single snapshot — migrated to {@link HISTORY_KEY} */
const LEGACY_HIGHLIGHT_KEY = "wg:last-auction-winner-highlight";

const HISTORY_KEY = "wg:auction-settlement-history";
const DISMISSED_FPS_KEY = "wg:auction-winners-dismissed";
const MAX_HISTORY = 40;
export const SETTLEMENT_DISPLAY_LIMIT = 5;

export type SettlementRecord = {
  fp: string;
  tokenId: number;
  bidder: Address;
  amountWei: string;
  recordedAt: number;
};

/** Snapshot shape before persisting (caller adds `recordedAt`). */
export type StoredWinnerHighlight = {
  fp: string;
  tokenId: number;
  bidder: Address;
  amountWei: string;
};

export function getWinnerFingerprint(
  tokenId: bigint,
  bidder: Address,
  amountWei: bigint,
): string {
  return `${tokenId}-${bidder}-${amountWei}`;
}

/** Shared CTA copy for rescue / claim flows. */
export function rescueStageCtaLabel(stage: RescueStage): string {
  switch (stage) {
    case "preparing":
      return "Preparing metadata…";
    case "awaiting-wallet":
      return "Confirm in wallet…";
    case "confirming":
      return "Submitting…";
    case "success":
      return "Rescued!";
    default:
      return "Claim warplet";
  }
}

function rescueStageCtaLabelInline(stage: RescueStage): string {
  switch (stage) {
    case "preparing":
      return "Prep…";
    case "awaiting-wallet":
      return "Wallet";
    case "confirming":
      return "…";
    case "success":
      return "Done";
    default:
      return "Claim";
  }
}

export type ClaimAction = {
  /** True only when the connected viewer is the winner of the last settled auction. */
  visible: boolean;
  stage: RescueStage;
  error: string | null;
  onClaim: () => void;
};

function isSettlementRecord(o: unknown): o is SettlementRecord {
  if (o == null || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return (
    typeof r.fp === "string" &&
    typeof r.tokenId === "number" &&
    typeof r.bidder === "string" &&
    typeof r.amountWei === "string" &&
    typeof r.recordedAt === "number"
  );
}

function migrateLegacyStorageOnce() {
  if (typeof window === "undefined") return;

  try {
    if (!localStorage.getItem(DISMISSED_FPS_KEY)) {
      const legacy = localStorage.getItem(LEGACY_DISMISSED_FP_KEY);
      if (legacy) {
        localStorage.setItem(DISMISSED_FPS_KEY, JSON.stringify([legacy]));
        localStorage.removeItem(LEGACY_DISMISSED_FP_KEY);
      } else {
        localStorage.setItem(DISMISSED_FPS_KEY, JSON.stringify([]));
      }
    }

    const legacyHi = localStorage.getItem(LEGACY_HIGHLIGHT_KEY);
    if (legacyHi) {
      const o = JSON.parse(legacyHi) as Partial<StoredWinnerHighlight>;
      if (
        typeof o.fp === "string" &&
        typeof o.tokenId === "number" &&
        typeof o.bidder === "string" &&
        typeof o.amountWei === "string"
      ) {
        const curRaw = localStorage.getItem(HISTORY_KEY);
        let cur: unknown[] = [];
        if (curRaw) {
          try {
            const p = JSON.parse(curRaw) as unknown;
            if (Array.isArray(p)) cur = p;
          } catch {
            /* ignore */
          }
        }
        const rec: SettlementRecord = {
          fp: o.fp,
          tokenId: o.tokenId,
          bidder: o.bidder as Address,
          amountWei: o.amountWei,
          recordedAt: Date.now(),
        };
        const merged = [
          rec,
          ...cur.filter((x) => isSettlementRecord(x) && x.fp !== rec.fp),
        ]
          .filter(isSettlementRecord)
          .slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
      }
      localStorage.removeItem(LEGACY_HIGHLIGHT_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function readDismissedFpArray(): string[] {
  if (typeof window === "undefined") return [];
  migrateLegacyStorageOnce();
  try {
    const raw = localStorage.getItem(DISMISSED_FPS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function addDismissedFp(fp: string): string[] {
  const cur = readDismissedFpArray();
  if (cur.includes(fp)) return cur;
  const next = [...cur, fp];
  try {
    localStorage.setItem(DISMISSED_FPS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function readSettlementHistory(): SettlementRecord[] {
  if (typeof window === "undefined") return [];
  migrateLegacyStorageOnce();
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(isSettlementRecord);
  } catch {
    return [];
  }
}

/** Dedupes by `fp`, caps length, persists. Returns the stored list. */
export function appendSettlementRecord(rec: SettlementRecord): SettlementRecord[] {
  const cur = readSettlementHistory();
  const idx = cur.findIndex((r) => r.fp === rec.fp);
  let next: SettlementRecord[];
  if (idx >= 0) {
    const prev = cur[idx]!;
    next = [...cur];
    next[idx] = {
      ...rec,
      recordedAt: Math.max(prev.recordedAt, rec.recordedAt),
    };
  } else {
    next = [rec, ...cur];
  }
  const trimmed = next.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return trimmed;
}

export function sortSettlementsForDisplay(
  rows: SettlementRecord[],
): SettlementRecord[] {
  return [...rows].sort((a, b) => {
    const ba = BigInt(b.amountWei);
    const aa = BigInt(a.amountWei);
    if (ba > aa) return 1;
    if (ba < aa) return -1;
    return b.recordedAt - a.recordedAt;
  });
}

/** Top `limit` by bid (then recency), but always include `focus` if set and not in that slice. */
export function pickDisplaySettlementRows(
  sortedAll: SettlementRecord[],
  focus: SettlementRecord | null,
  limit: number,
): SettlementRecord[] {
  const top = sortedAll.slice(0, limit);
  if (!focus) return top;
  if (top.some((r) => r.fp === focus.fp)) return top;
  const rest = sortedAll.filter((r) => r.fp !== focus.fp).slice(0, limit - 1);
  return [focus, ...rest];
}

/** Single-row last settled lot — image, #id, price, winner; optional claim + dismiss. */
export function LastAuctionWinnerInline({
  tokenId,
  winnerAddress,
  winAmountLabel,
  bidSymbol,
  viewerAddress,
  /** Mini App / known viewer identity when they match `winnerAddress`. */
  winnerDisplayOverride,
  winnerAvatarOverride,
  onDismiss,
  claim,
}: {
  tokenId: number;
  winnerAddress: Address;
  winAmountLabel: string;
  bidSymbol: string;
  viewerAddress?: Address | null;
  winnerDisplayOverride?: string | null;
  winnerAvatarOverride?: string | null;
  onDismiss: () => void;
  claim?: ClaimAction;
}) {
  const claimBusy =
    claim?.stage === "preparing" ||
    claim?.stage === "awaiting-wallet" ||
    claim?.stage === "confirming";
  const claimDone = claim?.stage === "success";

  return (
    <div className="relative flex min-h-[32px] w-full max-w-sm min-w-0 items-center gap-1.5 overflow-hidden rounded-md border border-success/20 bg-success/5 py-0.5 pl-1.5 pr-8 text-[11px] leading-none">
      <div className="h-[22px] w-[22px] shrink-0 overflow-hidden rounded border border-base-content/10">
        <AuctionWarpletImage fid={tokenId} variant="thumb" />
      </div>
      <span className="shrink-0 font-medium tabular-nums text-base-content/90">
        #{tokenId}
      </span>
      <span className="max-w-[4.25rem] shrink-0 truncate font-mono tabular-nums text-base-content/55">
        {winAmountLabel}{" "}
        <span className="text-base-content/40">{bidSymbol}</span>
      </span>
      <div className="flex min-h-0 min-w-[6.5rem] flex-1 items-center gap-1 overflow-hidden">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-base-content/35">
          by
        </span>
        <BidderAvatarName
          address={winnerAddress}
          viewerAddress={viewerAddress ?? undefined}
          displayNameOverride={winnerDisplayOverride ?? undefined}
          avatarUrlOverride={winnerAvatarOverride ?? undefined}
          size="xs"
          showViewerBadge={false}
          className="min-w-0 flex-1"
        />
      </div>
      {claim?.visible ? (
        <button
          type="button"
          title={claim.error ?? undefined}
          onClick={claim.onClaim}
          disabled={claimBusy || claimDone}
          className="btn btn-success btn-xs h-6 min-h-0 shrink-0 gap-1 px-2 py-0 text-[10px] uppercase tracking-wide"
        >
          {claimBusy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : null}
          {rescueStageCtaLabelInline(claim.stage)}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="btn btn-ghost btn-xs absolute right-0.5 top-1/2 h-6 w-6 min-h-0 -translate-y-1/2 p-0 text-base-content/35 hover:text-base-content/70"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function LastAuctionSettlementStack({
  rows,
  bidSymbol,
  formatBidAmount,
  viewerAddress,
  /** When the viewer won a row, prefer Mini App name over slow/empty API resolution. */
  viewerDisplayName,
  viewerPfpUrl,
  onDismissRow,
  claimForRow,
  className = "",
}: {
  rows: SettlementRecord[];
  bidSymbol: string;
  formatBidAmount: (wei: bigint) => string;
  viewerAddress?: Address | null;
  viewerDisplayName?: string | null;
  viewerPfpUrl?: string | null;
  onDismissRow: (fp: string) => void;
  claimForRow: (row: SettlementRecord) => ClaimAction | undefined;
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div
      className={`flex w-full max-w-sm flex-col items-stretch gap-1 ${className}`}
    >
      {rows.map((row) => {
        const viewerIsRowWinner =
          !!viewerAddress &&
          !isAddressEqual(viewerAddress, zeroAddress) &&
          isAddressEqual(viewerAddress, row.bidder);
        return (
          <LastAuctionWinnerInline
            key={row.fp}
            tokenId={row.tokenId}
            winnerAddress={row.bidder}
            winAmountLabel={formatBidAmount(BigInt(row.amountWei))}
            bidSymbol={bidSymbol}
            viewerAddress={viewerAddress}
            winnerDisplayOverride={viewerIsRowWinner ? viewerDisplayName : null}
            winnerAvatarOverride={viewerIsRowWinner ? viewerPfpUrl : null}
            onDismiss={() => onDismissRow(row.fp)}
            claim={claimForRow(row)}
          />
        );
      })}
    </div>
  );
}
