"use client";

import { isAddressEqual, zeroAddress } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { warpletsErc721EnumerableAbi } from "@/lib/warplets-abi";
import { warpletImageSrc } from "@/lib/warplet-image-src";
import {
  clearOwnedWarpletsCache,
  readOwnedWarpletsCache,
  writeOwnedWarpletsCache,
} from "@/lib/owned-warplets-cache";

export type OwnedWarplet = {
  tokenId: bigint;
  fid: number;
  name: string;
  imageSrc: string;
};

function tokenIdsToWarplets(tokenIds: bigint[]): OwnedWarplet[] {
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
}

export function useOwnedWarplets() {
  const { address, isConnected } = useAccount();
  const warpletsAddress = CONTRACTS.warplets;
  const warpletsConfigured = !isAddressEqual(warpletsAddress, zeroAddress);

  const [cacheEpoch, setCacheEpoch] = useState(0);

  const cachedPayload = useMemo(
    () => (address ? readOwnedWarpletsCache(address) : null),
    // `cacheEpoch` is not read inside the memo; it is an explicit invalidation
    // tick when we clear or refresh cache so this recomputes from storage.
    [address, cacheEpoch],
  );

  const cachedWarplets = useMemo((): OwnedWarplet[] => {
    if (!cachedPayload?.tokenIds.length) return [];
    try {
      const ids = cachedPayload.tokenIds.map((s) => BigInt(s));
      return tokenIdsToWarplets(ids);
    } catch {
      return [];
    }
  }, [cachedPayload]);

  const lastStableRef = useRef<{
    address: Address;
    warplets: OwnedWarplet[];
  } | null>(null);

  const mismatchRefetchRef = useRef(false);

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

  const warplets = useMemo(
    () => tokenIdsToWarplets(tokenIds),
    [tokenIds],
  );

  const cacheBalance = cachedPayload ? BigInt(cachedPayload.balance) : 0n;

  useEffect(() => {
    mismatchRefetchRef.current = false;
  }, [address]);

  useEffect(() => {
    if (
      !address ||
      !warpletsConfigured ||
      !balanceQuery.isSuccess ||
      balanceQuery.isFetching
    )
      return;
    if (balance !== 0n) return;
    if (cachedWarplets.length === 0) return;
    if (mismatchRefetchRef.current) return;
    mismatchRefetchRef.current = true;
    void balanceQuery.refetch();
  }, [
    address,
    warpletsConfigured,
    balance,
    balanceQuery.isSuccess,
    balanceQuery.isFetching,
    balanceQuery.refetch,
    cachedWarplets.length,
  ]);

  useEffect(() => {
    if (
      !address ||
      !warpletsConfigured ||
      !balanceQuery.isSuccess ||
      balanceQuery.isFetching
    )
      return;
    if (balance !== 0n) return;
    if (warplets.length !== 0) return;
    if (cacheBalance === 0n) return;
    if (!mismatchRefetchRef.current) return;
    clearOwnedWarpletsCache(address);
    setCacheEpoch((e) => e + 1);
  }, [
    address,
    warpletsConfigured,
    balance,
    balanceQuery.isSuccess,
    balanceQuery.isFetching,
    warplets.length,
    cacheBalance,
  ]);

  useEffect(() => {
    if (!address) {
      lastStableRef.current = null;
      return;
    }
    if (!warpletsConfigured) {
      return;
    }
    if (balanceQuery.isError || indexQuery.isError) {
      return;
    }

    const waitingOnBalance =
      !balanceQuery.isFetched ||
      balanceQuery.isPending ||
      balanceQuery.isFetching;
    const waitingOnIndex =
      indexContracts.length > 0 &&
      (!indexQuery.isFetched ||
        indexQuery.isPending ||
        indexQuery.isFetching);
    if (waitingOnBalance || waitingOnIndex) {
      return;
    }

    lastStableRef.current = { address, warplets };
    if (warplets.length === 0 && (balance ?? 0n) === 0n) {
      clearOwnedWarpletsCache(address);
      setCacheEpoch((e) => e + 1);
    } else if (warplets.length > 0 && balance !== undefined) {
      writeOwnedWarpletsCache(
        address,
        balance,
        warplets.map((w) => w.tokenId),
      );
    }
  }, [
    address,
    warplets,
    warpletsConfigured,
    balance,
    indexContracts.length,
    balanceQuery.isError,
    balanceQuery.isFetched,
    balanceQuery.isPending,
    balanceQuery.isFetching,
    indexQuery.isError,
    indexQuery.isFetched,
    indexQuery.isPending,
    indexQuery.isFetching,
  ]);

  const awaitingInitialBalance =
    Boolean(address) &&
    (!balanceQuery.isFetched || balanceQuery.isPending);

  const awaitingIndexForOwned =
    Boolean(address) &&
    balanceQuery.isFetched &&
    balance !== undefined &&
    balance > 0n &&
    indexContracts.length > 0 &&
    (!indexQuery.isFetched || indexQuery.isPending);

  const rpcClaimsNoBalanceButCacheDisagrees =
    Boolean(address) &&
    balanceQuery.isFetched &&
    balance === 0n &&
    warplets.length === 0 &&
    cacheBalance > 0n;

  const isLoading =
    Boolean(isConnected && warpletsConfigured && address) &&
    (awaitingInitialBalance ||
      awaitingIndexForOwned ||
      rpcClaimsNoBalanceButCacheDisagrees);

  const inFlightSameAddress =
    Boolean(address) &&
    !balanceQuery.isError &&
    !indexQuery.isError &&
    (balanceQuery.isFetching ||
      indexQuery.isFetching ||
      balanceQuery.isPending ||
      (indexContracts.length > 0 && indexQuery.isPending));

  const warpletsForUi = useMemo(() => {
    if (!address) return [];
    if (warplets.length > 0) return warplets;
    const stable = lastStableRef.current;
    if (
      stable &&
      stable.address === address &&
      inFlightSameAddress &&
      stable.warplets.length > 0
    ) {
      return stable.warplets;
    }
    if (
      cachedWarplets.length > 0 &&
      (isLoading || inFlightSameAddress)
    ) {
      return cachedWarplets;
    }
    return warplets;
  }, [
    address,
    warplets,
    isLoading,
    inFlightSameAddress,
    cachedWarplets,
  ]);

  const isError = balanceQuery.isError || indexQuery.isError;

  const refetch = useCallback(async () => {
    await balanceQuery.refetch();
    await indexQuery.refetch();
  }, [balanceQuery.refetch, indexQuery.refetch]);

  return {
    warplets: warpletsForUi,
    balance: balance ?? BigInt(0),
    isLoading,
    isError,
    isConnected,
    address,
    warpletsConfigured,
    refetch,
  };
}
