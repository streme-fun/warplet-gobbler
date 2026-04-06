"use client";

import { useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { erc777Abi } from "@/abi/erc777";

type PlaceBidArgs = {
  amount: bigint;
  bidTokenAddress: `0x${string}`;
};

/**
 * Places a bid on `AuctionSell` via Superfluid / ERC-777:
 * `bidToken.send(auction, amount, "")` → `tokensReceived` → `_bid`.
 */
export function useAuctionSell777Bid() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const approveAndBid = useCallback(
    async ({ amount, bidTokenAddress }: PlaceBidArgs) => {
      if (!address) {
        throw new Error("Connect a wallet to bid");
      }
      if (CONTRACTS.auctionSell === ZERO_ADDRESS) {
        throw new Error("Auction contract is not configured");
      }

      return writeContractAsync({
        abi: erc777Abi,
        address: bidTokenAddress,
        functionName: "send",
        args: [CONTRACTS.auctionSell, amount, "0x"],
      });
    },
    [address, writeContractAsync],
  );

  return {
    approveAndBid,
    isPending,
  };
}
