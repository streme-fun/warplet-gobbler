"use client";

import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";

export type BidderProfile = {
  address: Address;
  displayName: string | null;
  avatarUrl: string | null;
  source: string;
};

async function fetchBidderProfile(address: Address): Promise<BidderProfile> {
  const res = await fetch(`/api/bidder-profile/${address}`);
  if (!res.ok) {
    throw new Error("profile fetch failed");
  }
  return res.json() as Promise<BidderProfile>;
}

export function useBidderProfile(address: Address | null | undefined) {
  const enabled =
    !!address &&
    isAddress(address) &&
    address !== "0x0000000000000000000000000000000000000000";

  return useQuery({
    queryKey: ["bidder-profile", address],
    queryFn: () => fetchBidderProfile(address as Address),
    enabled,
    staleTime: 5 * 60_000,
  });
}
