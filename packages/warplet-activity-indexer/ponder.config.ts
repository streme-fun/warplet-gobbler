import { createConfig } from "ponder";
import { auctionSellAbi } from "./src/abis/auctionSell.js";
import { dutchAuctionAbi } from "./src/abis/dutchAuction.js";
import { resolveDatabaseConnectionString } from "./src/lib/database.js";
import { env, startBlock } from "./src/env.js";

const databaseConnectionString = resolveDatabaseConnectionString(process.env.DATABASE_URL, {
  sslMode: process.env.DATABASE_SSL_MODE,
});

export default createConfig({
  database: databaseConnectionString
    ? {
        kind: "postgres",
        connectionString: databaseConnectionString,
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
