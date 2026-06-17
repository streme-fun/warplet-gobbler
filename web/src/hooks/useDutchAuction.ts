"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Address, encodeAbiParameters, formatUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { base } from "wagmi/chains";
import { CONTRACTS, UNISWAP_V4_POOL_IDS } from "@/lib/contracts";
import { dutchAuctionAbi } from "@/abi/dutchAuction";
import { erc721Abi } from "@/abi/erc721";
import { erc20Abi } from "@/abi/erc20";
import { uniswapV3PoolAbi } from "@/abi/uniswapV3Pool";
import { stateViewAbi } from "@/abi/stateView";
import { WARPLET_SELLING_DISABLED } from "@/lib/migration";
const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function fetchGobblerPriceWei(): Promise<bigint> {
  const res = await fetch("/api/gobbler-current-price", { cache: "no-store" });
  if (!res.ok) throw new Error("Gobbler price unavailable");
  const body = (await res.json()) as { priceWei?: string };
  if (!body.priceWei) throw new Error("Gobbler price missing");
  return BigInt(body.priceWei);
}

/** Server-backed pot read — avoids stale Vercel env + Farcaster client RPC quirks. */
export function useDutchAuctionPrice() {
  const [sampleAt, setSampleAt] = useState(0);

  const query = useQuery({
    queryKey: ["gobbler-current-price"],
    queryFn: async () => {
      const priceWei = await fetchGobblerPriceWei();
      setSampleAt(Date.now());
      return priceWei;
    },
    refetchInterval: 2_000,
    staleTime: 0,
    retry: 3,
    // BigInt compares by value; still disable sharing so each poll re-runs payout math.
    structuralSharing: false,
  });

  return {
    data: query.data,
    // Wall-clock sample time on every successful fetch (not only when React Query
    // considers `data` changed) — needed for perSecond in useDutchAuctionPayoutStream.
    dataUpdatedAt: sampleAt || query.dataUpdatedAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
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
      if (delta < BigInt(0)) {
        // Pot drained (gobble). Reset — next positive sample rebuilds the rate.
        rateRef.current = 0;
      } else if (delta > BigInt(0) && dtSec >= 0.12) {
        const deltaHuman = Number(formatUnits(delta, tokenDecimals));
        const instantaneous = Math.max(0, deltaHuman / dtSec);
        // EMA smoothing: first good sample seeds the rate; later samples blend in.
        rateRef.current =
          rateRef.current === 0
            ? instantaneous
            : rateRef.current * 0.7 + instantaneous * 0.3;
      }
      // delta === 0: two polls hit the same block — keep the existing rate so
      // the UI keeps ticking instead of freezing.
    }

    prevRef.current = { v: priceWei, updatedAt: dataUpdatedAt };
    setOut({ start: human, perSecond: rateRef.current });
  }, [priceWei, tokenDecimals, dataUpdatedAt]);

  return out;
}

export function useDutchAuctionPayoutToken() {
  const isAuctionSet = CONTRACTS.dutchAuction.toLowerCase() !== ZERO;
  const paymentToken = useReadContract({
    chainId: base.id,
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
    chainId: base.id,
    abi: erc20Abi,
    address: resolvedTokenAddress,
    functionName: "symbol",
    query: {
      enabled: isResolvedTokenSet,
    },
  });

  const decimals = useReadContract({
    chainId: base.id,
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
  const hasWarpgobbWethV4Pool = warpgobbWethPoolId !== ZERO_BYTES32;

  const warpgobbAddr = CONTRACTS.warpgobbToken;
  const wethAddr = CONTRACTS.wethToken;
  const token0Address =
    warpgobbAddr.toLowerCase() < wethAddr.toLowerCase()
      ? warpgobbAddr
      : wethAddr;
  const token1Address =
    token0Address === warpgobbAddr ? wethAddr : warpgobbAddr;

  const gwSlot0 = useReadContract({
    chainId: base.id,
    abi: stateViewAbi,
    address: CONTRACTS.uniswapV4StateView,
    functionName: "getSlot0",
    args: [warpgobbWethPoolId as `0x${string}`],
    query: { enabled: hasWarpgobbWethV4Pool, refetchInterval: 15000 },
  });

  const wuToken0 = useReadContract({
    chainId: base.id,
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "token0",
    query: { enabled: hasWethUsdcPool },
  });
  const wuToken1 = useReadContract({
    chainId: base.id,
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "token1",
    query: { enabled: hasWethUsdcPool },
  });
  const wuSlot0 = useReadContract({
    chainId: base.id,
    abi: uniswapV3PoolAbi,
    address: wethUsdcPool,
    functionName: "slot0",
    query: { enabled: hasWethUsdcPool, refetchInterval: 15000 },
  });

  const token0Decimals = useReadContract({
    chainId: base.id,
    abi: erc20Abi,
    address: token0Address,
    functionName: "decimals",
    query: { enabled: hasWarpgobbWethV4Pool },
  });
  const token1Decimals = useReadContract({
    chainId: base.id,
    abi: erc20Abi,
    address: token1Address,
    functionName: "decimals",
    query: { enabled: hasWarpgobbWethV4Pool },
  });
  const wuToken0Decimals = useReadContract({
    chainId: base.id,
    abi: erc20Abi,
    address: wuToken0.data ?? CONTRACTS.wethToken,
    functionName: "decimals",
    query: { enabled: !!wuToken0.data },
  });
  const wuToken1Decimals = useReadContract({
    chainId: base.id,
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
        warpgobbInWeth = v4Token1PerToken0 === 0 ? null : 1 / v4Token1PerToken0;
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

/** `abi.encode(minPrice)` for `DutchAuction.onERC721Received` — required on every gobble tx. */
export function encodeDutchAuctionGobbleData(minPrice: bigint): `0x${string}` {
  return encodeAbiParameters([{ type: "uint256" }], [minPrice]);
}

export function useDutchAuctionActions() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  /**
   * One-tx gobble: `safeTransferFrom(owner, dutchAuction, tokenId, abi.encode(minPrice))`.
   * `minPrice` must match the snapshot used for slippage / frontrun protection (on-chain revert if pot < minPrice).
   */
  const gobbleWarplet = async (tokenId: number, minPrice: bigint) => {
    if (WARPLET_SELLING_DISABLED) {
      throw new Error("Warplet selling is temporarily paused.");
    }
    if (!address) {
      throw new Error("Connect wallet to sell");
    }
    if (CONTRACTS.warplets.toLowerCase() === ZERO) {
      throw new Error("Selling isn’t available right now.");
    }
    if (CONTRACTS.dutchAuction.toLowerCase() === ZERO) {
      throw new Error("The Gobbler isn’t ready to buy right now.");
    }
    const data = encodeDutchAuctionGobbleData(minPrice);

    return writeContractAsync({
      abi: erc721Abi,
      address: CONTRACTS.warplets,
      functionName: "safeTransferFrom",
      args: [address as Address, CONTRACTS.dutchAuction, BigInt(tokenId), data],
    });
  };

  return {
    gobbleWarplet,
    isWriting: isPending,
  };
}
