import { ponder } from "ponder:registry";
import { processActivity } from "./lib/event-processor.js";
function baseEventId(txHash, logIndex) {
    return `${txHash}:${logIndex}`;
}
ponder.on("AuctionSell:BidPlaced", async ({ event, context }) => {
    await processActivity(context, {
        id: baseEventId(event.transaction.hash, event.log.logIndex),
        type: "BID_PLACED",
        chainId: context.chain.id,
        contractAddress: event.log.address,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        logIndex: event.log.logIndex,
        actorAddress: event.args.bidder,
        tokenId: event.args.tokenId,
        amount: event.args.amount,
        summary: `Bid placed by ${event.args.bidder} on warplet #${event.args.tokenId.toString()}`,
        metadata: {
            bidder: event.args.bidder,
            tokenId: event.args.tokenId.toString(),
            amount: event.args.amount.toString(),
        },
    });
});
ponder.on("DutchAuction:Gobbled", async ({ event, context }) => {
    await processActivity(context, {
        id: baseEventId(event.transaction.hash, event.log.logIndex),
        type: "WARPLET_GOBBLED",
        chainId: context.chain.id,
        contractAddress: event.log.address,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        logIndex: event.log.logIndex,
        actorAddress: event.args.seller,
        tokenId: event.args.tokenId,
        payout: event.args.payout,
        summary: `Warplet #${event.args.tokenId.toString()} gobbled from ${event.args.seller}`,
        metadata: {
            seller: event.args.seller,
            tokenId: event.args.tokenId.toString(),
            payout: event.args.payout.toString(),
        },
    });
});
ponder.on("AuctionSell:AuctionSettled", async ({ event, context }) => {
    await processActivity(context, {
        id: baseEventId(event.transaction.hash, event.log.logIndex),
        type: "AUCTION_SETTLED",
        chainId: context.chain.id,
        contractAddress: event.log.address,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        transactionHash: event.transaction.hash,
        logIndex: event.log.logIndex,
        actorAddress: event.args.winner,
        tokenId: event.args.tokenId,
        amount: event.args.amount,
        gobbledTokenId: event.args.gobbledTokenId,
        summary: `Auction settled for warplet #${event.args.tokenId.toString()} with winner ${event.args.winner}`,
        metadata: {
            winner: event.args.winner,
            tokenId: event.args.tokenId.toString(),
            amount: event.args.amount.toString(),
            gobbledTokenId: event.args.gobbledTokenId.toString(),
        },
    });
});
//# sourceMappingURL=index.js.map