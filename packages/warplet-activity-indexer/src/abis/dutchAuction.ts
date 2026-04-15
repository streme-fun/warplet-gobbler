export const dutchAuctionAbi = [
  {
    type: "event",
    name: "Gobbled",
    inputs: [
      { indexed: true, name: "seller", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: false, name: "payout", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;
