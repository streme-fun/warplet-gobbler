import { isAddressEqual, zeroAddress, type PublicClient } from "viem";
import { CONTRACTS } from "@/lib/contracts";

const ownerOfAbi = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "address" }],
  },
] as const;

const nftReserveAbi = [
  {
    name: "nftReserve",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

/**
 * Warplets in the flywheel are held by DutchAuction’s `nftReserve` (deploy: AuctionSell) while
 * queued / on auction / awaiting rescue. Accept either address so preview APIs match on-chain
 * reality even if env `NEXT_PUBLIC_DUTCH_AUCTION_ADDRESS` / `nftReserve` is misaligned.
 */
type ReadContractClient = Pick<PublicClient, "readContract">;

export async function isWarpletInGobblerAuctionCustody(
  publicClient: ReadContractClient,
  warpletTokenId: bigint,
): Promise<boolean> {
  if (isAddressEqual(CONTRACTS.warplets, zeroAddress)) return false;
  if (isAddressEqual(CONTRACTS.dutchAuction, zeroAddress)) return false;

  try {
    const owner = await publicClient.readContract({
      address: CONTRACTS.warplets,
      abi: ownerOfAbi,
      functionName: "ownerOf",
      args: [warpletTokenId],
    });

    const nftReserve = await publicClient.readContract({
      address: CONTRACTS.dutchAuction,
      abi: nftReserveAbi,
      functionName: "nftReserve",
    });

    if (isAddressEqual(owner, nftReserve)) return true;

    if (
      !isAddressEqual(CONTRACTS.auctionSell, zeroAddress) &&
      isAddressEqual(owner, CONTRACTS.auctionSell)
    ) {
      return true;
    }

    if (
      !isAddressEqual(CONTRACTS.auctionSellLegacy, zeroAddress) &&
      isAddressEqual(owner, CONTRACTS.auctionSellLegacy)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
