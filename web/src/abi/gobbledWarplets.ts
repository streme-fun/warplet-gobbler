/**
 * GobbledWarplets — receipt NFT minted to auction winners.
 *
 * Settlement reserves a `tokenId = gobbleIndex * WARPLET_ID_PADDING + warpletId` for the winner;
 * the winner claims via signed `rescueWarplet`, which mints the receipt with `tokenURI = uri`
 * and pulls the underlying Warplet from `AuctionSell` when still held there.
 */
export const gobbledWarpletsAbi = [
  {
    type: "function",
    name: "rescueWarplet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "uri", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  // Legacy deployed GobbledWarplets includes an unsigned rescue overload:
  // `rescueWarplet(uint256 warpletId)` which only pulls the underlying Warplet.
  // We keep it in the ABI for a one-off migration flow for `#987458`.
  {
    type: "function",
    name: "rescueWarplet",
    stateMutability: "nonpayable",
    inputs: [{ name: "warpletId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "gobbleCount",
    stateMutability: "view",
    inputs: [{ name: "warpletId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "warpletRescued",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "WARPLET_ID_PADDING",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "tokenURISetter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;
