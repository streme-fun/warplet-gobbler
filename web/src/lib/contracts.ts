import { type Address } from "viem";

// Contract addresses — update after deployment
export const CONTRACTS = {
  dutchAuction: "0x0000000000000000000000000000000000000000" as Address,
  auctionSell: "0x0000000000000000000000000000000000000000" as Address,
  staking: "0x0000000000000000000000000000000000000000" as Address,
  stratToken: "0x0000000000000000000000000000000000000000" as Address,
  warplets: "0x0000000000000000000000000000000000000000" as Address, // Warplets NFT collection on Base
  usdcx: "0x0000000000000000000000000000000000000000" as Address, // USDCx on Base
} as const;
