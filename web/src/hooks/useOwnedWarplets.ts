"use client";

import { isAddressEqual, zeroAddress } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
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

  const cachedPayload = useMemo(() => {
    // Explicit invalidation tick when cache is cleared or refreshed.
    void cacheEpoch;
    return address ? readOwnedWarpletsCache(address) : null;
  }, [address, cacheEpoch]);

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

  // Pin every Warplets read to Base regardless of the wallet's current chain —
  // the NFT contract only lives on Base, so targeting the wallet's chain throws
  // whenever the user is connected to mainnet, Optimism, etc.
  const {
    data: balance,
    isSuccess: balanceIsSuccess,
    isFetching: balanceIsFetching,
    isError: balanceIsError,
    isFetched: balanceIsFetched,
    isPending: balanceIsPending,
    refetch: refetchBalance,
  } = useReadContract({
    chainId: base.id,
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
      chainId: base.id,
      address: warpletsAddress,
      abi: warpletsErc721EnumerableAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, balance, warpletsAddress]);

  const {
    data: ownerIndexResults,
    isError: indexIsError,
    isFetched: indexIsFetched,
    isPending: indexIsPending,
    isFetching: indexIsFetching,
    refetch: refetchIndex,
  } = useReadContracts({
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

  const warplets = useMemo(() => tokenIdsToWarplets(tokenIds), [tokenIds]);

  const cacheBalance = cachedPayload ? BigInt(cachedPayload.balance) : 0n;

  useEffect(() => {
    mismatchRefetchRef.current = false;
  }, [address]);

  useEffect(() => {
    if (
      !address ||
      !warpletsConfigured ||
      !balanceIsSuccess ||
      balanceIsFetching
    )
      return;
    if (balance !== 0n) return;
    if (cachedWarplets.length === 0) return;
    if (mismatchRefetchRef.current) return;
    mismatchRefetchRef.current = true;
    void refetchBalance();
  }, [
    address,
    warpletsConfigured,
    balance,
    balanceIsSuccess,
    balanceIsFetching,
    refetchBalance,
    cachedWarplets.length,
  ]);

  useEffect(() => {
    if (
      !address ||
      !warpletsConfigured ||
      !balanceIsSuccess ||
      balanceIsFetching
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
    balanceIsSuccess,
    balanceIsFetching,
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
    if (balanceIsError || indexIsError) {
      return;
    }

    const waitingOnBalance =
      !balanceIsFetched || balanceIsPending || balanceIsFetching;
    const waitingOnIndex =
      indexContracts.length > 0 &&
      (!indexIsFetched || indexIsPending || indexIsFetching);
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
    balanceIsError,
    balanceIsFetched,
    balanceIsPending,
    balanceIsFetching,
    indexIsError,
    indexIsFetched,
    indexIsPending,
    indexIsFetching,
  ]);

  const awaitingInitialBalance =
    Boolean(address) && (!balanceIsFetched || balanceIsPending);

  const awaitingIndexForOwned =
    Boolean(address) &&
    balanceIsFetched &&
    balance !== undefined &&
    balance > 0n &&
    indexContracts.length > 0 &&
    (!indexIsFetched || indexIsPending);

  const rpcClaimsNoBalanceButCacheDisagrees =
    Boolean(address) &&
    balanceIsFetched &&
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
    !balanceIsError &&
    !indexIsError &&
    (balanceIsFetching ||
      indexIsFetching ||
      balanceIsPending ||
      (indexContracts.length > 0 && indexIsPending));

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
    if (cachedWarplets.length > 0 && (isLoading || inFlightSameAddress)) {
      return cachedWarplets;
    }
    return warplets;
  }, [address, warplets, isLoading, inFlightSameAddress, cachedWarplets]);

  const isError = balanceIsError || indexIsError;

  const refetch = useCallback(async () => {
    await refetchBalance();
    await refetchIndex();
  }, [refetchBalance, refetchIndex]);

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
