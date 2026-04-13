"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import { isAddressEqual, zeroAddress, type Address } from "viem";
import { useBidderProfile } from "@/hooks/useBidderProfile";

function shortAddr(a: Address) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function BidderAvatarName({
  address,
  viewerAddress,
  className = "",
  /** When set (e.g. Mini App display name), wins over resolved profile name. */
  displayNameOverride,
  /** When set (e.g. Mini App pfp), used if the profile API has no avatar yet. */
  avatarUrlOverride,
  /** If false, viewer with no resolved name shows truncated address instead of "You". */
  showYouWhenViewer = true,
  /** If false, hides the small "You" / "Leading" pills (e.g. rescue / claim UI). */
  showViewerBadge = true,
  /** Larger avatar + type for hero moments. */
  size = "md",
}: {
  address: Address;
  viewerAddress?: Address | null;
  className?: string;
  displayNameOverride?: string | null;
  avatarUrlOverride?: string | null;
  showYouWhenViewer?: boolean;
  showViewerBadge?: boolean;
  size?: "xs" | "md" | "lg";
}) {
  const { data, isLoading, isSuccess } = useBidderProfile(address);

  const resolvedName = useMemo(() => {
    const o = displayNameOverride?.trim();
    if (o) return o;
    return data?.displayName?.trim() || null;
  }, [displayNameOverride, data?.displayName]);

  const isYou =
    viewerAddress &&
    !isAddressEqual(viewerAddress, zeroAddress) &&
    isAddressEqual(viewerAddress, address);

  /** Prefer ENS / Superfluid whois / override; only fall back to address when nothing resolved. */
  const primaryLine = useMemo(() => {
    if (resolvedName) return resolvedName;
    if (isYou && showYouWhenViewer) return "You";
    return shortAddr(address);
  }, [resolvedName, isYou, address, showYouWhenViewer]);

  const avatar =
    (avatarUrlOverride?.trim() || null) ?? data?.avatarUrl ?? null;
  const showResolvedSubaddress =
    size !== "xs" && Boolean(resolvedName) && !isYou;

  const gapClass = size === "xs" ? "gap-1.5" : "gap-2.5";
  const avatarBox =
    size === "xs"
      ? "w-5 h-5"
      : size === "lg"
        ? "w-14 h-14 sm:w-16 sm:h-16"
        : "w-9 h-9 sm:w-10 sm:h-10";
  const nameText =
    size === "xs"
      ? "text-[11px] leading-tight"
      : size === "lg"
        ? "text-base sm:text-lg"
        : "text-sm";

  return (
    <div
      className={`flex items-center ${gapClass} min-w-0 ${className}`}
      title={address}
    >
      <div
        className={`${avatarBox} rounded-full overflow-hidden border border-secondary/30 bg-base-300/50 shrink-0`}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              isLoading && !isSuccess
                ? "animate-pulse bg-base-content/10"
                : ""
            }`}
          >
            {!isLoading || isSuccess ? (
              <span className="text-[10px] font-mono text-base-content/35">
                ?
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          className={`font-medium ${nameText} text-secondary/95 truncate`}
        >
          <span>{primaryLine}</span>
          {showViewerBadge && isYou && resolvedName ? (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-success/90">
              You
            </span>
          ) : null}
          {showViewerBadge && isYou && !resolvedName ? (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-success/90">
              Leading
            </span>
          ) : null}
        </p>
        {showResolvedSubaddress ? (
          <p className="text-[11px] font-mono text-base-content/40 truncate">
            {shortAddr(address)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
