"use client";

import { encodeAbiParameters, type Address } from "viem";
import { useWriteContract } from "wagmi";
import { erc777Abi } from "@/abi/erc777";

/**
 * Move a queued Warplet to the head via ERC777 `send(queueBumpFee, userData)`
 * where `userData = abi.encode(uint256 tokenId, uint256 prev)` (linked-list AuctionSell).
 */
export function useAuctionQueueBump() {
  const { writeContractAsync, isPending } = useWriteContract();

  const sendBumpTx = async (params: {
    bidTokenAddress: Address;
    auctionSellAddress: Address;
    amount: bigint;
    tokenId: bigint;
    prev: bigint;
  }) => {
    const userData = encodeAbiParameters(
      [
        { type: "uint256", name: "tokenId" },
        { type: "uint256", name: "prev" },
      ],
      [params.tokenId, params.prev],
    );
    return writeContractAsync({
      abi: erc777Abi,
      address: params.bidTokenAddress,
      functionName: "send",
      args: [params.auctionSellAddress, params.amount, userData],
    });
  };

  return { sendBumpTx, isPending };
}
