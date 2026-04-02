"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useCallback, useMemo } from "react";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { warpletsErc721EnumerableAbi } from "@/lib/warplets-abi";
import { warpletImageSrc } from "@/lib/warplet-image-src";

export type OwnedWarplet = {
  tokenId: bigint;
  fid: number;
  name: string;
  imageSrc: string;
};

export function useOwnedWarplets() {
  const { address, isConnected } = useAccount();
  const warpletsAddress = CONTRACTS.warplets;
  const warpletsConfigured =
    warpletsAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  const { data: balance, ...balanceQuery } = useReadContract({
    address: warpletsAddress,
    abi: warpletsErc721EnumerableAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && warpletsConfigured),
    },
  });

  const indexContracts = useMemo(() => {
    if (!address || balance === undefined || balance === BigInt(0)) return [];
    const n = Number(balance);
    if (!Number.isSafeInteger(n) || n <= 0) return [];
    return Array.from({ length: n }, (_, i) => ({
      address: warpletsAddress,
      abi: warpletsErc721EnumerableAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, balance, warpletsAddress]);

  const { data: ownerIndexResults, ...indexQuery } = useReadContracts({
    contracts: indexContracts,
    query: {
      enabled: indexContracts.length > 0,
    },
  });

  const tokenIds = useMemo(() => {
    if (!ownerIndexResults) return [];
    const ids: bigint[] = [];
    for (const row of ownerIndexResults) {
      if (row.status === "success" && row.result !== undefined) {
        ids.push(row.result);
      }
    }
    return ids;
  }, [ownerIndexResults]);

  const warplets = useMemo((): OwnedWarplet[] => {
    return tokenIds.map((tokenId) => {
      const fid = Number(tokenId);
      return {
        tokenId,
        fid,
        name: `Warplet #${fid}`,
        imageSrc: Number.isSafeInteger(fid)
          ? warpletImageSrc(fid)
          : "/warplet.png",
      };
    });
  }, [tokenIds]);

  const isLoading =
    Boolean(isConnected && address && warpletsConfigured) &&
    (balanceQuery.isPending ||
      (indexContracts.length > 0 && indexQuery.isPending));

  const isError =
    balanceQuery.isError || indexQuery.isError;

  const refetch = useCallback(async () => {
    await balanceQuery.refetch();
    await indexQuery.refetch();
  }, [balanceQuery.refetch, indexQuery.refetch]);

  return {
    warplets,
    balance: balance ?? BigInt(0),
    isLoading,
    isError,
    isConnected,
    address,
    warpletsConfigured,
    refetch,
  };
}
