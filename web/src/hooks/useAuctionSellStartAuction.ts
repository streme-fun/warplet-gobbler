"use client";

import { useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";

export function useAuctionSellStartAuction(opts: {
  refetchAuction: () => Promise<unknown>;
  refetchQueue?: () => Promise<unknown>;
}) {
  const { refetchAuction, refetchQueue } = opts;
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const afterTx = useCallback(
    async (hash: `0x${string}`) => {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refetchAuction();
      await refetchQueue?.();
    },
    [publicClient, refetchAuction, refetchQueue],
  );

  /** `tokenId` must match `nextQueuedTokenId()` on-chain. */
  const startAuction = useCallback(
    async (nextTokenId: bigint) => {
      const hash = await writeContractAsync({
        abi: auctionSellAbi,
        address: CONTRACTS.auctionSell,
        functionName: "startAuction",
        args: [nextTokenId],
      });
      await afterTx(hash);
    },
    [afterTx, writeContractAsync],
  );

  return { startAuction, isPending };
}
