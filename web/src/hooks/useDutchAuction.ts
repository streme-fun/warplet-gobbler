"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { CONTRACTS, UNISWAP_V4_POOL_IDS } from "@/lib/contracts";
import { dutchAuctionAbi } from "@/abi/dutchAuction";
import { erc721Abi } from "@/abi/erc721";
import { erc20Abi } from "@/abi/erc20";
import { uniswapV3PoolAbi } from "@/abi/uniswapV3Pool";
import { stateViewAbi } from "@/abi/stateView";
const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function useDutchAuctionPrice() {
  return useReadContract({
    abi: dutchAuctionAbi,
    address: CONTRACTS.dutchAuction,
    functionName: "currentPrice",
    query: {
      refetchInterval: 1_000,
    },
  });
}

/**
 * Human-readable payout + estimated tokens/sec from consecutive balance reads.
 * Pass `dataUpdatedAt` from the same `useDutchAuctionPrice()` result so each poll
 * updates the sample even when the bigint value is unchanged (needed for rate = 0).
 */
export function useDutchAuctionPayoutStream(
  priceWei: bigint | undefined,
  tokenDecimals: number,
  dataUpdatedAt: number,
) {
  const prevRef = useRef<{ v: bigint; updatedAt: number } | null>(null);
  const rateRef = useRef(0);
  const [out, setOut] = useState({ start: 0, perSecond: 0 });

  useEffect(() => {
    if (priceWei === undefined) {
      prevRef.current = null;
      rateRef.current = 0;
      setOut({ start: 0, perSecond: 0 });
      return;
    }
    if (!dataUpdatedAt) return;

    const human = Number(formatUnits(priceWei, tokenDecimals));
    const prev = prevRef.current;

    if (prev && dataUpdatedAt > prev.updatedAt) {
      const dtSec = (dataUpdatedAt - prev.updatedAt) / 1000;
      const delta = priceWei - prev.v;
      if (delta <= BigInt(0)) {
        rateRef.current = 0;
      } else if (dtSec >= 0.12) {
        const deltaHuman = Number(formatUnits(delta, tokenDecimals));
        rateRef.current = Math.max(0, deltaHuman / dtSec);
      }
    }

    prevRef.current = { v: priceWei, updatedAt: dataUpdatedAt };
    setOut({ start: human, perSecond: rateRef.current });
  }, [priceWei, tokenDecimals, dataUpdatedAt]);

  return out;
}

export function useDutchAuctionPayoutToken() {
  const isAuctionSet = CONTRACTS.dutchAuction.toLowerCase() !== ZERO;
  const paymentToken = useReadContract({
    abi: dutchAuctionAbi,
    address: CONTRACTS.dutchAuction,
    functionName: "paymentToken",
    query: {
      enabled: isAuctionSet,
    },
  });

  const tokenAddress = paymentToken.data;
  const resolvedTokenAddress = tokenAddress ?? CONTRACTS.warpgobbToken;
  const isResolvedTokenSet = resolvedTokenAddress.toLowerCase() !== ZERO;

  const symbol = useReadContract({
    abi: erc20Abi,
    address: resolvedTokenAddress,
    functionName: "symbol",
    query: {
      enabled: isResolvedTokenSet,
    },
  });

  const decimals = useReadContract({
    abi: erc20Abi,
    address: resolvedTokenAddress,
    functionName: "decimals",
    query: {
      enabled: isResolvedTokenSet,
    },
  });

  return {
    address: resolvedTokenAddress,
    symbol: symbol.data ?? "WARPGOBB",
    decimals: Number(decimals.data ?? 18),
    isLoading: paymentToken.isLoading || symbol.isLoading || decimals.isLoading,
  };
}

export function useWarpgobbUsdPrice() {
  const wethUsdcPool = CONTRACTS.wethUsdcPool;
  const hasWethUsdcPool = wethUsdcPool.toLowerCase() !== ZERO;
  const warpgobbWethPoolId = UNISWAP_V4_POOL_IDS.warpgobbWeth;
  const hasWarpgobbWethV4Pool =
    warpgobbWethPoolId !== ZERO_BYTES32;

  const warpgobbAddr = CONTRACTS.warpgobbToken;
  const wethAddr = CONTRACTS.wethToken;
  const token0Address =
    warpgobbAddr.toLowerCase() < wethAddr.toLowerCase() ? warpgobbAddr : wethAddr;
  const token1Address = token0Address === warpgobbAddr ? wethAddr : warpgobbAddr;

  const gwSlot0 = useReadContract({
    abi: stateViewAbi,
    address: CONTRACTS.uniswapV4StateView,
    functionName: "getSlot0",
    args: [warpgobbWethPoolId as `0x${string}`],
    query: { enabled: hasWarpgobbWethV4Pool, refetchInterval: 15000 },
  });

  const wuToken0 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "token0",
    query: { enabled: hasWethUsdcPool },
  });
  const wuToken1 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "token1",
    query: { enabled: hasWethUsdcPool },
  });
  const wuSlot0 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "slot0",
    query: { enabled: hasWethUsdcPool, refetchInterval: 15000 },
  });

  const token0Decimals = useReadContract({
    abi: erc20Abi,
    address: token0Address,
    functionName: "decimals",
    query: { enabled: hasWarpgobbWethV4Pool },
  });
  const token1Decimals = useReadContract({
    abi: erc20Abi,
    address: token1Address,
    functionName: "decimals",
    query: { enabled: hasWarpgobbWethV4Pool },
  });
  const wuToken0Decimals = useReadContract({
    abi: erc20Abi,
    address: wuToken0.data ?? CONTRACTS.wethToken,
    functionName: "decimals",
    query: { enabled: !!wuToken0.data },
  });
  const wuToken1Decimals = useReadContract({
    abi: erc20Abi,
    address: wuToken1.data ?? CONTRACTS.usdcToken,
    functionName: "decimals",
    query: { enabled: !!wuToken1.data },
  });

  /**
   * Uniswap v3/v4 spot: token1 per 1 token0 (human decimals), from sqrtPriceX96.
   * Uses log form so tiny meme/WETH ratios don't truncate to 0 in BigInt division.
   */
  const calcToken1PerToken0 = (
    sqrtPriceX96: bigint,
    token0Decimals: bigint | number,
    token1Decimals: bigint | number,
  ) => {
    if (sqrtPriceX96 <= BigInt(0)) return 0;
    const d0 = Number(token0Decimals);
    const d1 = Number(token1Decimals);
    const sp = Number(sqrtPriceX96);
    return Math.exp(2 * Math.log(sp) - 192 * Math.LN2 + (d0 - d1) * Math.LN10);
  };

  const priceUsd = useMemo((): number | null => {
    const warpgobb = CONTRACTS.warpgobbToken.toLowerCase();
    const weth = CONTRACTS.wethToken.toLowerCase();
    const usdc = CONTRACTS.usdcToken.toLowerCase();

    const fromPools = (): number | null => {
      if (!gwSlot0.data) return null;
      if (!token0Decimals.data || !token1Decimals.data) return null;
      if (!wuToken0.data || !wuToken1.data) return null;
      if (!wuSlot0.data) return null;
      if (!wuToken0Decimals.data || !wuToken1Decimals.data) return null;

      const v4Token0 = token0Address.toLowerCase();
      const v4Token1 = token1Address.toLowerCase();
      const v4Token1PerToken0 = calcToken1PerToken0(
        gwSlot0.data[0],
        token0Decimals.data,
        token1Decimals.data,
      );

      // v4 spot gives price(token1/token0). We want WETH per WARPGOBB.
      let warpgobbInWeth: number | null = null;
      if (v4Token0 === warpgobb && v4Token1 === weth) {
        warpgobbInWeth = v4Token1PerToken0;
      } else if (v4Token0 === weth && v4Token1 === warpgobb) {
        warpgobbInWeth =
          v4Token1PerToken0 === 0 ? null : 1 / v4Token1PerToken0;
      }

      const v3Token0 = wuToken0.data.toLowerCase();
      const v3Token1 = wuToken1.data.toLowerCase();
      const v3Token1PerToken0 = calcToken1PerToken0(
        wuSlot0.data[0],
        wuToken0Decimals.data,
        wuToken1Decimals.data,
      );

      // v3 spot gives price(token1/token0). We want USDC per WETH.
      let wethInUsdc: number | null = null;
      if (v3Token0 === weth && v3Token1 === usdc) {
        wethInUsdc = v3Token1PerToken0;
      } else if (v3Token0 === usdc && v3Token1 === weth) {
        wethInUsdc = v3Token1PerToken0 === 0 ? null : 1 / v3Token1PerToken0;
      }

      if (warpgobbInWeth === null || wethInUsdc === null) return null;
      const spot = warpgobbInWeth * wethInUsdc;
      if (!Number.isFinite(spot) || spot <= 0) return null;
      return spot;
    };

    return fromPools();
  }, [
    token0Address,
    token1Address,
    gwSlot0.data,
    token0Decimals.data,
    token1Decimals.data,
    wuToken0.data,
    wuToken1.data,
    wuSlot0.data,
    wuToken0Decimals.data,
    wuToken1Decimals.data,
  ]);

  return {
    priceUsd,
    isLoading:
      gwSlot0.isLoading ||
      token0Decimals.isLoading ||
      token1Decimals.isLoading ||
      wuToken0.isLoading ||
      wuToken1.isLoading ||
      wuSlot0.isLoading ||
      wuToken0Decimals.isLoading ||
      wuToken1Decimals.isLoading,
  };
}

export function useWarpletApproval(tokenId: number | null) {
  const { address } = useAccount();

  const approvedForToken = useReadContract({
    abi: erc721Abi,
    address: CONTRACTS.warplets,
    functionName: "getApproved",
    args: [BigInt(tokenId ?? 0)],
    query: {
      enabled: !!tokenId,
    },
  });

  const approvedForAll = useReadContract({
    abi: erc721Abi,
    address: CONTRACTS.warplets,
    functionName: "isApprovedForAll",
    args: [address ?? CONTRACTS.dutchAuction, CONTRACTS.dutchAuction],
    query: {
      enabled: !!address,
    },
  });

  const isApproved = useMemo(() => {
    if (!tokenId) return false;
    if (approvedForAll.data) return true;
    return (
      typeof approvedForToken.data === "string" &&
      approvedForToken.data.toLowerCase() === CONTRACTS.dutchAuction.toLowerCase()
    );
  }, [tokenId, approvedForAll.data, approvedForToken.data]);

  return {
    isApproved,
    isApprovalLoading: approvedForAll.isLoading || approvedForToken.isLoading,
    refetchApproval: async () => {
      await Promise.all([approvedForAll.refetch(), approvedForToken.refetch()]);
    },
  };
}

export function useDutchAuctionActions() {
  const { writeContractAsync, isPending } = useWriteContract();

  const approveWarplet = async (tokenId: number) => {
    return writeContractAsync({
      abi: erc721Abi,
      address: CONTRACTS.warplets,
      functionName: "approve",
      args: [CONTRACTS.dutchAuction, BigInt(tokenId)],
    });
  };

  const gobbleWarplet = async (tokenId: number, minPrice: bigint) => {
    return writeContractAsync({
      abi: dutchAuctionAbi,
      address: CONTRACTS.dutchAuction,
      functionName: "gobble",
      args: [BigInt(tokenId), minPrice],
    });
  };

  return {
    approveWarplet,
    gobbleWarplet,
    isWriting: isPending,
  };
}
