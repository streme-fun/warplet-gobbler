import { createConfig } from "ponder";
import { auctionSellAbi } from "./src/abis/auctionSell.js";
import { dutchAuctionAbi } from "./src/abis/dutchAuction.js";
import { env, startBlock } from "./src/env.js";
export default createConfig({
    database: process.env.DATABASE_URL
        ? {
            kind: "postgres",
            connectionString: process.env.DATABASE_URL,
        }
        : {
            kind: "pglite",
            directory: "./.ponder/pglite",
        },
    chains: {
        base: {
            id: 8453,
            rpc: env.ponderRpcUrl8453,
            ws: env.ponderWsUrl8453,
        },
    },
    contracts: {
        AuctionSell: {
            abi: auctionSellAbi,
            chain: "base",
            address: env.auctionSellAddress,
            startBlock,
        },
        DutchAuction: {
            abi: dutchAuctionAbi,
            chain: "base",
            address: env.dutchAuctionAddress,
            startBlock,
        },
    },
});
//# sourceMappingURL=ponder.config.js.map