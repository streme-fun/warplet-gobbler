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
}: {
  address: Address;
  viewerAddress?: Address | null;
  className?: string;
}) {
  const { data, isLoading, isSuccess } = useBidderProfile(address);

  const resolvedName = data?.displayName?.trim() || null;

  const isYou =
    viewerAddress &&
    !isAddressEqual(viewerAddress, zeroAddress) &&
    isAddressEqual(viewerAddress, address);

  /** Prefer ENS / Superfluid whois name; only fall back to address when nothing resolved. */
  const primaryLine = useMemo(() => {
    if (resolvedName) return resolvedName;
    if (isYou) return "You";
    return shortAddr(address);
  }, [resolvedName, isYou, address]);

  const avatar = data?.avatarUrl;
  const showResolvedSubaddress =
    Boolean(resolvedName) && !isYou;

  return (
    <div
      className={`flex items-center gap-2.5 min-w-0 ${className}`}
      title={address}
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-secondary/30 bg-base-300/50 shrink-0">
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
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-secondary/95 truncate">
          <span>{primaryLine}</span>
          {isYou && resolvedName ? (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-success/90">
              You
            </span>
          ) : null}
          {isYou && !resolvedName ? (
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
