export const auctionSellAbi = [
    {
        type: "event",
        name: "BidPlaced",
        inputs: [
            { indexed: true, name: "tokenId", type: "uint256" },
            { indexed: true, name: "bidder", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "AuctionSettled",
        inputs: [
            { indexed: true, name: "tokenId", type: "uint256" },
            { indexed: true, name: "winner", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
            { indexed: false, name: "gobbledTokenId", type: "uint256" },
        ],
        anonymous: false,
    },
];
//# sourceMappingURL=auctionSell.js.map