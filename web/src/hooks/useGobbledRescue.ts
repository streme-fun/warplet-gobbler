"use client";

import { useCallback, useState } from "react";
import {
  type Address,
  type Hash,
  type Hex,
  isAddressEqual,
  zeroAddress,
} from "viem";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { gobbledWarpletsAbi } from "@/abi/gobbledWarplets";
import { CONTRACTS } from "@/lib/contracts";
import { formatUserFacingTxError } from "@/lib/format-tx-error";

/**
 * Step the UI can surface while a rescue is in flight. The hook only ever advances forward —
 * never reverts to an earlier step except via `reset()` after success / error.
 */
export type RescueStage =
  | "idle"
  | "preparing" // POSTing to /api/mint-gobbled-nft (image, metadata, signature)
  | "awaiting-wallet" // waiting for the user to confirm in their wallet
  | "confirming" // tx submitted, waiting for receipt
  | "success"
  | "error";

type SignedRescuePayload = {
  warpletId: number;
  tokenId: string; // reserved GobbledWarplets receipt id as decimal string
  uri: string;
  deadline: string; // bigint as decimal string
  signature: Hex;
};

async function fetchSignedPayload(
  warpletId: number,
  gobbledTokenId?: string,
): Promise<SignedRescuePayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch("/api/mint-gobbled-nft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ warpletId, gobbledTokenId }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Preparing your claim timed out. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  const json = (await res.json()) as
    | (SignedRescuePayload & { success: true })
    | { success: false; error?: string };
  if (!res.ok || !json.success) {
    const msg = !json.success && json.error ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Drives claim for auction winners via signed `rescueWarplet` on GobbledWarplets.
 */
export function useGobbledRescue(opts: { contractAddress?: Address } = {}) {
  const contractAddress = opts.contractAddress ?? CONTRACTS.gobbledWarplets;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();

  const [stage, setStage] = useState<RescueStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const ready = !isAddressEqual(contractAddress, zeroAddress as Address);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setTxHash(null);
  }, []);

  const claim = useCallback(
    async (warpletId: number, gobbledTokenId?: string) => {
      if (!ready) {
        setError("Claiming isn’t available right now. Please try again later.");
        setStage("error");
        return;
      }
      if (!isConnected || address == null) {
        setError("Connect the wallet that won the auction to claim this Warplet.");
        setStage("error");
        return;
      }
      if (!publicClient) {
        setError("Wallet connection isn’t ready yet. Please try again.");
        setStage("error");
        return;
      }

      setError(null);
      setTxHash(null);
      setStage("preparing");
      try {
        const payload = await fetchSignedPayload(warpletId, gobbledTokenId);

        setStage("awaiting-wallet");

        const hash = await writeContractAsync({
          chainId: base.id,
          account: address,
          address: contractAddress,
          abi: gobbledWarpletsAbi,
          functionName: "rescueWarplet",
          args: [
            BigInt(payload.tokenId),
            payload.uri,
            BigInt(payload.deadline),
            payload.signature,
          ],
        });

        setTxHash(hash);
        setStage("confirming");
        await publicClient.waitForTransactionReceipt({ hash });
        setStage("success");
      } catch (e) {
        setError(formatUserFacingTxError(e));
        setStage("error");
      }
    },
    [
      ready,
      isConnected,
      address,
      publicClient,
      contractAddress,
      writeContractAsync,
    ],
  );

  return {
    ready,
    stage,
    error,
    txHash,
    claim,
    reset,
    isPending:
      stage === "preparing" ||
      stage === "awaiting-wallet" ||
      stage === "confirming",
  };
}
