"use client";

import { useCallback, useState } from "react";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { auctionSellAbi } from "@/abi/auctionSell";
import { CONTRACTS } from "@/lib/contracts";

export type AuctionStartTxStage = "signing" | "confirming";

export function useAuctionSellStartAuction(opts: {
  refetchAuction: () => Promise<unknown>;
  refetchQueue?: () => Promise<unknown>;
}) {
  const { refetchAuction, refetchQueue } = opts;
  const { address } = useAccount();
  const { writeContractAsync, isPending: wagmiMutationPending } =
    useWriteContract();
  const publicClient = usePublicClient();

  const [txPhase, setTxPhase] = useState<
    "idle" | AuctionStartTxStage
  >("idle");

  /** True for the full flow (wallet prompt → receipt). Wagmi’s `isPending` alone often misses the first frames. */
  const isPending = txPhase !== "idle" || wagmiMutationPending;

  const startAuction = useCallback(
    async (nextTokenId: bigint) => {
      if (!address) {
        throw new Error("Connect your wallet first.");
      }
      setTxPhase("signing");
      try {
        const hash = await writeContractAsync({
          abi: auctionSellAbi,
          address: CONTRACTS.auctionSell,
          functionName: "startAuction",
          args: [nextTokenId],
          chainId: base.id,
          account: address,
        });
        setTxPhase("confirming");
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        await refetchAuction();
        await refetchQueue?.();
      } finally {
        setTxPhase("idle");
      }
    },
    [
      address,
      publicClient,
      refetchAuction,
      refetchQueue,
      writeContractAsync,
    ],
  );

  const loadingStage: AuctionStartTxStage | null =
    txPhase === "idle" ? null : txPhase;

  return { startAuction, isPending, loadingStage };
}
