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
  const { data, isLoading } = useBidderProfile(address);

  const label = useMemo(() => {
    if (!data?.displayName) return shortAddr(address);
    return data.displayName;
  }, [data?.displayName, address]);

  const isYou =
    viewerAddress &&
    !isAddressEqual(viewerAddress, zeroAddress) &&
    isAddressEqual(viewerAddress, address);

  const avatar = data?.avatarUrl;

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-secondary/30 bg-base-300/50 shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-base-content/35">
            {isLoading ? "···" : "?"}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-secondary/95 truncate">
          {isYou ? "You" : label}
          {isYou && (
            <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-success/90">
              leading
            </span>
          )}
        </p>
        {!isYou && data?.displayName && (
          <p className="text-[11px] font-mono text-base-content/40 truncate">
            {shortAddr(address)}
          </p>
        )}
      </div>
    </div>
  );
}
