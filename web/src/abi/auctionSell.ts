/**
 * AuctionSell (linked-list queue + ERC777 bump) — keep in sync with `feat/auction-linked-list-queue` contract.
 * Stubs on `main` revert on these reads; UI falls back to mocks when queries error.
 */
export const auctionSellAbi = [
  {
    type: "function",
    name: "auction",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "bidder", type: "address" },
          { name: "settled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getQueuedTokenIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256[]", name: "orderedIds" }],
  },
  {
    type: "function",
    name: "queueBumpFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bidToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "bid",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "reservePrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "minBidIncrementPercentage",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
