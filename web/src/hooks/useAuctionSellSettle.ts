"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";

export type AuctionSettleTxStage = "signing" | "confirming" | "syncing";

export function useAuctionSellSettleActions(opts: {
  refetchAuction: () => Promise<unknown>;
  refetchQueue?: () => Promise<unknown>;
}) {
  const { refetchAuction, refetchQueue } = opts;
  const { writeContractAsync, isPending: wagmiMutationPending } =
    useWriteContract();
  const publicClient = usePublicClient();

  const [txPhase, setTxPhase] = useState<"idle" | AuctionSettleTxStage>("idle");

  const isPending = txPhase !== "idle" || wagmiMutationPending;

  const afterReceipt = useCallback(async () => {
    setTxPhase("syncing");
    await refetchAuction();
    await refetchQueue?.();
  }, [refetchAuction, refetchQueue]);

  const runWithStages = useCallback(
    async (write: () => Promise<`0x${string}`>) => {
      setTxPhase("signing");
      try {
        const hash = await write();
        setTxPhase("confirming");
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        await afterReceipt();
      } finally {
        setTxPhase("idle");
      }
    },
    [afterReceipt, publicClient],
  );

  /** When contract is paused — completes settlement, transfers NFT to winner, pays proceeds. */
  const settleWhenPaused = useCallback(async () => {
    await runWithStages(() =>
      writeContractAsync({
        abi: auctionSellAbi,
        address: CONTRACTS.auctionSell,
        functionName: "settle",
      }),
    );
  }, [runWithStages, writeContractAsync]);

  /** When not paused — settle then pull next token from queue into a new auction (if any). */
  const settleAndStartNext = useCallback(async () => {
    await runWithStages(() =>
      writeContractAsync({
        abi: auctionSellAbi,
        address: CONTRACTS.auctionSell,
        functionName: "settleCurrentAndCreateNewAuction",
      }),
    );
  }, [runWithStages, writeContractAsync]);

  /** When lot ended with zero bids — extends end time by one `duration` (not paused). */
  const extendAuction = useCallback(async () => {
    await runWithStages(() =>
      writeContractAsync({
        abi: auctionSellAbi,
        address: CONTRACTS.auctionSell,
        functionName: "extendAuction",
      }),
    );
  }, [runWithStages, writeContractAsync]);

  const loadingStage: AuctionSettleTxStage | null =
    txPhase === "idle" ? null : txPhase;

  return {
    settleWhenPaused,
    settleAndStartNext,
    extendAuction,
    isPending,
    loadingStage,
  };
}
