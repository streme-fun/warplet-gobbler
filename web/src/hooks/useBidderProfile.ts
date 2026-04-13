"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAddress,
  isAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
} from "viem";

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

async function fetchBidderProfile(address: Address): Promise<BidderProfile> {
  const res = await fetch(`/api/bidder-profile/${address}`);
  if (!res.ok) {
    throw new Error("profile fetch failed");
  }
  return res.json() as Promise<BidderProfile>;
}

export function useBidderProfile(address: Address | null | undefined) {
  const normalized = normalizeProfileAddress(address ?? null);
  const enabled = !!normalized;

  return useQuery({
    queryKey: ["bidder-profile", normalized],
    queryFn: () => fetchBidderProfile(normalized as Address),
    enabled,
    staleTime: 5 * 60_000,
  });
}
