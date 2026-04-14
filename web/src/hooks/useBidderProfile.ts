"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import {
  getAddress,
  isAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
} from "viem";
import { useMiniApp } from "@/hooks/useMiniApp";

export type BidderProfile = {
  address: Address;
  displayName: string | null;
  avatarUrl: string | null;
  source: string;
};

function normalizeProfileAddress(
  address: Address | null | undefined,
): Address | null {
  if (!address || !isAddress(address)) return null;
  try {
    const checksum = getAddress(address);
    if (isAddressEqual(checksum, zeroAddress)) return null;
    return checksum;
  } catch {
    return null;
  }
}

/** Farcaster Mini App `context.user` — fields vary slightly by SDK version. */
function profileFromMiniAppUser(
  normalized: Address,
  user: Record<string, unknown>,
): BidderProfile {
  const u = user as {
    displayName?: string;
    fid?: number;
    pfpUrl?: string;
    pfp?: string;
    profileImageUrl?: string;
  };
  const displayName =
    (typeof u.displayName === "string" && u.displayName.trim()) ||
    (typeof u.fid === "number" ? `FID ${u.fid}` : null);
  const avatarUrl =
    (typeof u.pfpUrl === "string" && u.pfpUrl.trim()) ||
    (typeof u.pfp === "string" && u.pfp.trim()) ||
    (typeof u.profileImageUrl === "string" && u.profileImageUrl.trim()) ||
    null;
  return {
    address: normalized,
    displayName,
    avatarUrl,
    source: "farcaster_miniapp",
  };
}

async function fetchBidderProfile(address: Address): Promise<BidderProfile> {
  const res = await fetch(`/api/bidder-profile/${address}`);
  if (!res.ok) {
    throw new Error("profile fetch failed");
  }
  return res.json() as Promise<BidderProfile>;
}

export function useBidderProfile(address: Address | null | undefined) {
  const { address: accountAddr } = useAccount();
  const { isMiniApp, isLoaded: miniAppLoaded, context } = useMiniApp();

  const normalized = normalizeProfileAddress(address ?? null);
  const connectedNorm = normalizeProfileAddress(accountAddr ?? null);

  const isConnectedViewerAddress = useMemo(
    () =>
      !!normalized &&
      !!connectedNorm &&
      isAddressEqual(normalized, connectedNorm),
    [normalized, connectedNorm],
  );

  const miniAppSelfProfile = useMemo((): BidderProfile | null => {
    if (
      !isMiniApp ||
      !miniAppLoaded ||
      !context?.user ||
      !normalized ||
      !isConnectedViewerAddress
    ) {
      return null;
    }
    return profileFromMiniAppUser(
      normalized,
      context.user as Record<string, unknown>,
    );
  }, [
    isMiniApp,
    miniAppLoaded,
    context?.user,
    normalized,
    isConnectedViewerAddress,
  ]);

  /** Don’t hit `/api/bidder-profile` (or Neynar) for the viewer in the Mini App — use host context. */
  const skipRemoteForMiniAppSelf =
    isMiniApp && isConnectedViewerAddress && !!miniAppSelfProfile;

  /** While Mini App SDK is still loading, avoid a redundant self fetch before `context.user` exists. */
  const deferRemoteUntilMiniReady =
    isMiniApp && isConnectedViewerAddress && !miniAppLoaded;

  const queryEnabled =
    !!normalized &&
    !skipRemoteForMiniAppSelf &&
    !deferRemoteUntilMiniReady;

  const q = useQuery({
    queryKey: ["bidder-profile", normalized],
    queryFn: () => fetchBidderProfile(normalized as Address),
    enabled: queryEnabled,
    staleTime: 5 * 60_000,
  });

  const data = miniAppSelfProfile ?? q.data;
  const waitingForMiniContext =
    isMiniApp && isConnectedViewerAddress && !miniAppLoaded;

  return {
    ...q,
    data,
    isPending: miniAppSelfProfile
      ? false
      : waitingForMiniContext
        ? true
        : q.isPending,
    isLoading: miniAppSelfProfile
      ? false
      : waitingForMiniContext
        ? true
        : q.isLoading,
    isFetching: miniAppSelfProfile ? false : q.isFetching,
    isSuccess: miniAppSelfProfile ? true : q.isSuccess,
    isError: miniAppSelfProfile ? false : q.isError,
    error: miniAppSelfProfile ? null : q.error,
    status: miniAppSelfProfile ? "success" : q.status,
    fetchStatus: miniAppSelfProfile ? "idle" : q.fetchStatus,
  };
}
