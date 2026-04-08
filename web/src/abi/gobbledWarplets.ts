/**
 * GobbledWarplets — receipt NFT minted to auction winners.
 *
 * Settlement reserves a `tokenId = gobbleIndex * WARPLET_ID_PADDING + warpletId` for the winner;
 * the winner finalizes by calling the signed `rescueWarplet` overload, which mints the receipt
 * with `tokenURI = uri` AND pulls the underlying Warplet from `AuctionSell` in the same tx.
 *
 * Two `rescueWarplet` overloads exist on the contract; this ABI only declares the signed one
 * (variant 2) since variant 1 is reserved for emergency use and is intentionally NOT wired in UI.
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
