/** Minimal ERC777 / Superfluid Super Token — `send` for queue bump userData payments. */
export const erc777Abi = [
  {
    type: "function",
    name: "send",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "userData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
