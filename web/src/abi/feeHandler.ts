export const feeHandlerAbi = [
  {
    type: "function",
    name: "auction",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "streamActive",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "targetDuration",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewFlowRate",
    inputs: [],
    outputs: [{ name: "", type: "int96" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentFlowRate",
    inputs: [],
    outputs: [{ name: "", type: "int96" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "WethSwapped",
    inputs: [
      { name: "zap", type: "address", indexed: true },
      { name: "wethIn", type: "uint256", indexed: false },
      { name: "tokenOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardsClaimedAndSwapped",
    inputs: [
      { name: "caller", type: "address", indexed: true },
      { name: "wethClaimed", type: "uint256", indexed: false },
      { name: "wethSwapped", type: "uint256", indexed: false },
      { name: "stremeOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FlowRateRebalanced",
    inputs: [
      { name: "auction", type: "address", indexed: true },
      { name: "flowRate", type: "int96", indexed: false },
    ],
  },
] as const;
