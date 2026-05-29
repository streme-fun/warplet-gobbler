/**
 * AuctionSell (linked-list queue + ERC777 bump).
 *
 * The deployed production contract returns a 5-field `auction()` struct
 * (tokenId, amount, startTime, endTime, bidder) without an on-chain
 * `settled` flag — settlement is derived client-side from `endTime < now`.
 * An earlier draft ABI here declared a 6-field tuple including `settled`,
 * which broke viem's decoder on production: 160 bytes came back, 192 were
 * expected, and the read silently errored, leaving the UI stuck in the
 * loading skeleton forever. Viem ignores trailing bytes when decoding
 * fixed tuples, so this shape also decodes cleanly against any future
 * variant that adds more fields after `bidder`.
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
        ],
      },
    ],
  },
  {
    type: "function",
    name: "currentAuction",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "highBidder", type: "address" },
      { name: "highBid", type: "uint256" },
      { name: "endTime", type: "uint256" },
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
    name: "nextQueuedTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
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
    name: "stremeZap",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "bid",
    stateMutability: "payable",
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
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "settleCurrentAndCreateNewAuction",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "extendAuction",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "startAuction",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "AuctionSettled",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "gobbledTokenId", type: "uint256", indexed: false },
    ],
  },
] as const;
