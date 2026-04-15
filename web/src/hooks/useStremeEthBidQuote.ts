"use client";

import { useQuery } from "@tanstack/react-query";
import { formatEther, isAddressEqual, type Address, zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import {
  applyEthQuoteBuffer,
  quoteMinEthForZapBid,
} from "@/lib/stremeZapEthQuote";

const QUOTE_FALLBACK_FROM =
  "0x0000000000000000000000000000000000000001" as Address;
const DEFAULT_BUFFER_BPS = 75n;

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
  const quoteAccount = address ?? QUOTE_FALLBACK_FROM;

  const enabled = rawEnabled && !!publicClient && zapOk && tokenOk && bidOk;

  return useQuery({
    queryKey: [
      "stremeEthBidQuote",
      publicClient?.chain?.id,
      zapAddress,
      bidTokenAddress,
      bidWei?.toString(),
      bufferBps.toString(),
      quoteAccount,
    ],
    enabled,
    queryFn: async () => {
      const r = await quoteMinEthForZapBid(
        publicClient!,
        quoteAccount,
        zapAddress!,
        bidTokenAddress!,
        bidWei!,
      );
      if (!r) {
        throw new Error(
          "Could not find ETH amount to clear this bid at current liquidity.",
        );
      }
      const txValueWei = applyEthQuoteBuffer(r.minEthWei, bufferBps);
      return {
        minEthWei: r.minEthWei,
        expectedOutWei: r.expectedOutWei,
        txValueWei,
        minEthFormatted: formatEther(r.minEthWei),
        txValueFormatted: formatEther(txValueWei),
      };
    },
    staleTime: 12_000,
    gcTime: 60_000,
  });
}
