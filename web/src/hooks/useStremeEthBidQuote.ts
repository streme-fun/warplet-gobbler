"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther, isAddressEqual, type Address, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import {
  applyBidQuoteDiscount,
  applyEthQuoteBuffer,
  quoteMinEthForZapBid,
  quoteZapBidForEthSpend,
} from "@/lib/stremeZapEthQuote";

const DEFAULT_BUFFER_BPS = 300n;

export function useStremeEthBidQuote(opts: {
  enabled: boolean;
  zapAddress: Address | undefined;
  bidTokenAddress: Address | undefined;
  bidWei: bigint | null;
  bufferBps?: bigint;
}) {
  const {
    enabled: rawEnabled,
    zapAddress,
    bidTokenAddress,
    bidWei,
    bufferBps = DEFAULT_BUFFER_BPS,
  } = opts;

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const zapOk = zapAddress != null && !isAddressEqual(zapAddress, zeroAddress);
  const tokenOk =
    bidTokenAddress != null && !isAddressEqual(bidTokenAddress, zeroAddress);
  const bidOk = bidWei != null && bidWei > 0n;
  const hasConnectedAddress = address != null;

  const enabled =
    rawEnabled &&
    !!publicClient &&
    zapOk &&
    tokenOk &&
    bidOk &&
    hasConnectedAddress;

  return useQuery({
    queryKey: [
      "stremeEthBidQuote",
      publicClient?.chain?.id,
      zapAddress,
      bidTokenAddress,
      bidWei?.toString(),
      bufferBps.toString(),
      address,
    ],
    enabled,
    queryFn: async () => {
      const r = await quoteMinEthForZapBid(
        publicClient!,
        address as Address,
        zapAddress!,
        bidTokenAddress!,
        bidWei!,
      );
      if (!r) {
        throw new Error(
          "Could not find ETH amount to clear this bid at current liquidity.",
        );
      }
      const bufferedTxValueWei = applyEthQuoteBuffer(r.minEthWei, bufferBps);
      return {
        minEthWei: r.minEthWei,
        expectedOutWei: r.expectedOutWei,
        txValueWei: bufferedTxValueWei,
        minEthFormatted: formatEther(r.minEthWei),
        txValueFormatted: formatEther(bufferedTxValueWei),
      };
    },
    staleTime: 4_000,
    gcTime: 60_000,
    retry: false,
  });
}

export function useStremeEthSpendQuote(opts: {
  enabled: boolean;
  zapAddress: Address | undefined;
  bidTokenAddress: Address | undefined;
  ethWei: bigint | null;
  discountBps?: bigint;
}) {
  const {
    enabled: rawEnabled,
    zapAddress,
    bidTokenAddress,
    ethWei,
    discountBps = DEFAULT_BUFFER_BPS,
  } = opts;

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const zapOk = zapAddress != null && !isAddressEqual(zapAddress, zeroAddress);
  const tokenOk =
    bidTokenAddress != null && !isAddressEqual(bidTokenAddress, zeroAddress);
  const ethOk = ethWei != null && ethWei > 0n;
  const hasConnectedAddress = address != null;

  const enabled =
    rawEnabled && !!publicClient && zapOk && tokenOk && ethOk && hasConnectedAddress;

  return useQuery({
    queryKey: [
      "stremeEthSpendQuote",
      publicClient?.chain?.id,
      zapAddress,
      bidTokenAddress,
      ethWei?.toString(),
      discountBps.toString(),
      address,
    ],
    enabled,
    queryFn: async () => {
      const r = await quoteZapBidForEthSpend(
        publicClient!,
        address as Address,
        zapAddress!,
        bidTokenAddress!,
        ethWei!,
      );
      if (!r) {
        throw new Error(
          "Could not estimate the WARPGOBB bid for this ETH amount.",
        );
      }
      const bidWei = applyBidQuoteDiscount(r.expectedOutWei, discountBps);
      if (bidWei <= 0n) {
        throw new Error(
          "Could not estimate the WARPGOBB bid for this ETH amount.",
        );
      }
      return {
        expectedOutWei: r.expectedOutWei,
        bidWei,
      };
    },
    staleTime: 4_000,
    gcTime: 60_000,
    retry: false,
  });
}
