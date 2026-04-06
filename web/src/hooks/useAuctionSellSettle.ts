"use client";

import { useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";

export function useAuctionSellSettleActions(opts: {
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

  /** When contract is paused — completes settlement, transfers NFT to winner, pays proceeds. */
  const settleWhenPaused = useCallback(async () => {
    const hash = await writeContractAsync({
      abi: auctionSellAbi,
      address: CONTRACTS.auctionSell,
      functionName: "settle",
    });
    await afterTx(hash);
  }, [afterTx, writeContractAsync]);

  /** When not paused — settle then pull next token from queue into a new auction (if any). */
  const settleAndStartNext = useCallback(async () => {
    const hash = await writeContractAsync({
      abi: auctionSellAbi,
      address: CONTRACTS.auctionSell,
      functionName: "settleCurrentAndCreateNewAuction",
    });
    await afterTx(hash);
  }, [afterTx, writeContractAsync]);

  /** When lot ended with zero bids — extends end time by one `duration` (not paused). */
  const extendAuction = useCallback(async () => {
    const hash = await writeContractAsync({
      abi: auctionSellAbi,
      address: CONTRACTS.auctionSell,
      functionName: "extendAuction",
    });
    await afterTx(hash);
  }, [afterTx, writeContractAsync]);

  return {
    settleWhenPaused,
    settleAndStartNext,
    extendAuction,
    isPending,
  };
}
