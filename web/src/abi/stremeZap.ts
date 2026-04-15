/** Minimal ABI for Streme `StremeZapUniversal.zap` used for ETH bid quoting. */
export const stremeZapAbi = [
  {
    type: "function",
    name: "zap",
    stateMutability: "payable",
    inputs: [
      { name: "stremeCoin", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "stakingContract", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;
