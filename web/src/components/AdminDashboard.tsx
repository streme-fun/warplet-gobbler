"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  formatUnits,
  parseAbiItem,
  zeroAddress,
  type Address,
} from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { erc20Abi } from "@/abi/erc20";
import { erc721Abi } from "@/abi/erc721";
import { feeHandlerAbi } from "@/abi/feeHandler";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSellQueue } from "@/hooks/useAuctionSellQueue";
import {
  useDutchAuctionPayoutStream,
  useDutchAuctionPayoutToken,
  useDutchAuctionPrice,
  useWarpgobbUsdPrice,
} from "@/hooks/useDutchAuction";
import { CONTRACTS } from "@/lib/contracts";
import { formatDuration } from "@/lib/format-duration";
import { computeLogScanWindows } from "@/lib/log-scan";

const DEFAULT_LOG_LOOKBACK_BLOCKS = 120_000n;
const ADMIN_LOG_LOOKBACK_BLOCKS = parsePositiveBigInt(
  process.env.NEXT_PUBLIC_ADMIN_LOG_LOOKBACK_BLOCKS,
  DEFAULT_LOG_LOOKBACK_BLOCKS,
);
const ADMIN_LOG_CHUNK_BLOCKS = 10_000n;
const ACTIVITY_REFRESH_MS = 30_000;
const MAX_ACTIVITY_ROWS = 80;

const bidPlacedEvent = parseAbiItem(
  "event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount)",
);
const auctionSettledEvent = parseAbiItem(
  "event AuctionSettled(uint256 indexed tokenId, address indexed winner, uint256 amount, uint256 gobbledTokenId)",
);
const gobbledEvent = parseAbiItem(
  "event Gobbled(address indexed seller, uint256 indexed tokenId, uint256 payout)",
);
const tokenEnqueuedEvent = parseAbiItem(
  "event TokenEnqueued(uint256 indexed tokenId)",
);
const queueBumpedEvent = parseAbiItem(
  "event QueueBumped(address indexed payer, uint256 indexed tokenId, uint256 fee)",
);
const rewardsClaimedAndSwappedEvent = parseAbiItem(
  "event RewardsClaimedAndSwapped(address indexed caller, uint256 wethClaimed, uint256 wethSwapped, uint256 stremeOut)",
);
const flowRateRebalancedEvent = parseAbiItem(
  "event FlowRateRebalanced(address indexed auction, int96 flowRate)",
);

type ActivityKind =
  | "bid"
  | "gobble"
  | "settlement"
  | "queued"
  | "queue-bump"
  | "rewards"
  | "flow";

type AdminActivity = {
  id: string;
  kind: ActivityKind;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
  tokenId?: bigint;
  actor?: Address;
  amountRaw?: bigint;
  secondaryRaw?: bigint;
  signedAmountRaw?: bigint;
  label: string;
  detail: string;
};

type ActivitySummary = {
  bidCount: number;
  bidVolume: bigint;
  gobbleCount: number;
  gobblePayout: bigint;
  settlementCount: number;
  settlementVolume: bigint;
  queueBumpCount: number;
  queueBumpFees: bigint;
  rewardCount: number;
  stremeOut: bigint;
  latestFlowRate?: bigint;
};

type ScanState = {
  status: "idle" | "loading" | "ready" | "error";
  rows: AdminActivity[];
  summary: ActivitySummary;
  fromBlock?: bigint;
  latestBlock?: bigint;
  scannedAt?: number;
  error?: string;
};

function parsePositiveBigInt(raw: string | undefined, fallback: bigint) {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = BigInt(raw);
  return parsed > 0n ? parsed : fallback;
}

function emptySummary(): ActivitySummary {
  return {
    bidCount: 0,
    bidVolume: 0n,
    gobbleCount: 0,
    gobblePayout: 0n,
    settlementCount: 0,
    settlementVolume: 0n,
    queueBumpCount: 0,
    queueBumpFees: 0n,
    rewardCount: 0,
    stremeOut: 0n,
  };
}

function summarizeActivity(rows: AdminActivity[]): ActivitySummary {
  return rows.reduce((summary, row) => {
    if (row.kind === "bid") {
      summary.bidCount += 1;
      summary.bidVolume += row.amountRaw ?? 0n;
    }
    if (row.kind === "gobble") {
      summary.gobbleCount += 1;
      summary.gobblePayout += row.amountRaw ?? 0n;
    }
    if (row.kind === "settlement") {
      summary.settlementCount += 1;
      summary.settlementVolume += row.amountRaw ?? 0n;
    }
    if (row.kind === "queue-bump") {
      summary.queueBumpCount += 1;
      summary.queueBumpFees += row.amountRaw ?? 0n;
    }
    if (row.kind === "rewards") {
      summary.rewardCount += 1;
      summary.stremeOut += row.secondaryRaw ?? 0n;
    }
    if (row.kind === "flow" && row.signedAmountRaw != null) {
      summary.latestFlowRate =
        summary.latestFlowRate == null ? row.signedAmountRaw : summary.latestFlowRate;
    }
    return summary;
  }, emptySummary());
}

function isConfiguredAddress(address?: string | null): address is Address {
  return !!address && address.toLowerCase() !== zeroAddress;
}

function shortAddress(address?: string | null) {
  if (!address || !isConfiguredAddress(address)) return "Not set";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(
  amountRaw: bigint | undefined | null,
  decimals: number,
  maximumFractionDigits = 4,
) {
  if (amountRaw == null) return "--";
  const formatted = formatUnits(amountRaw, decimals);
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return formatted;
  if (numeric === 0) return "0";
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: numeric < 1 ? 8 : maximumFractionDigits,
  });
}

function formatSignedTokenRate(rateRaw: bigint | undefined | null, decimals: number) {
  if (rateRaw == null) return "--";
  const sign = rateRaw < 0n ? "-" : "";
  const magnitude = rateRaw < 0n ? -rateRaw : rateRaw;
  return `${sign}${formatTokenAmount(magnitude, decimals, 6)}/s`;
}

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  if (value === 0) return "$0";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 0.01 ? 8 : 4,
  });
}

function formatWhole(value: bigint | number | undefined | null) {
  if (value == null) return "--";
  return Number(value).toLocaleString();
}

function formatBlockRange(fromBlock?: bigint, toBlock?: bigint) {
  if (fromBlock == null || toBlock == null) return "Waiting for RPC";
  return `#${fromBlock.toString()} - #${toBlock.toString()}`;
}

function formatScanAge(scannedAt?: number) {
  if (!scannedAt) return "Not scanned yet";
  const seconds = Math.max(0, Math.floor((Date.now() - scannedAt) / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function txUrl(hash: `0x${string}`) {
  return `https://basescan.org/tx/${hash}`;
}

function useNowUnix() {
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowUnix(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return nowUnix;
}

function useAdminActivityScan() {
  const publicClient = usePublicClient({ chainId: base.id });
  const scanSeq = useRef(0);
  const [state, setState] = useState<ScanState>({
    status: "idle",
    rows: [],
    summary: emptySummary(),
  });

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    const seq = ++scanSeq.current;

    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined,
    }));

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const windows = computeLogScanWindows(
        latestBlock,
        ADMIN_LOG_LOOKBACK_BLOCKS,
        ADMIN_LOG_CHUNK_BLOCKS,
      );
      const rows: AdminActivity[] = [];

      for (const window of windows) {
        const calls: Promise<void>[] = [];

        if (isConfiguredAddress(CONTRACTS.auctionSell)) {
          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.auctionSell,
                event: bidPlacedEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:bid`,
                    kind: "bid",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    tokenId: log.args.tokenId,
                    actor: log.args.bidder,
                    amountRaw: log.args.amount,
                    label: `Bid on #${log.args.tokenId?.toString() ?? "?"}`,
                    detail: `${shortAddress(log.args.bidder)} placed a bid`,
                  });
                }
              }),
          );

          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.auctionSell,
                event: auctionSettledEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:settlement`,
                    kind: "settlement",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    tokenId: log.args.tokenId,
                    actor: log.args.winner,
                    amountRaw: log.args.amount,
                    secondaryRaw: log.args.gobbledTokenId,
                    label: `Auction settled #${log.args.tokenId?.toString() ?? "?"}`,
                    detail: `${shortAddress(log.args.winner)} won receipt #${log.args.gobbledTokenId?.toString() ?? "?"}`,
                  });
                }
              }),
          );

          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.auctionSell,
                event: tokenEnqueuedEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:queued`,
                    kind: "queued",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    tokenId: log.args.tokenId,
                    label: `Queued #${log.args.tokenId?.toString() ?? "?"}`,
                    detail: "Warplet entered the auction queue",
                  });
                }
              }),
          );

          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.auctionSell,
                event: queueBumpedEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:queue-bump`,
                    kind: "queue-bump",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    tokenId: log.args.tokenId,
                    actor: log.args.payer,
                    amountRaw: log.args.fee,
                    label: `Queue bump #${log.args.tokenId?.toString() ?? "?"}`,
                    detail: `${shortAddress(log.args.payer)} moved a Warplet forward`,
                  });
                }
              }),
          );
        }

        if (isConfiguredAddress(CONTRACTS.dutchAuction)) {
          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.dutchAuction,
                event: gobbledEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:gobble`,
                    kind: "gobble",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    tokenId: log.args.tokenId,
                    actor: log.args.seller,
                    amountRaw: log.args.payout,
                    label: `Gobbled #${log.args.tokenId?.toString() ?? "?"}`,
                    detail: `${shortAddress(log.args.seller)} drained the pot`,
                  });
                }
              }),
          );
        }

        if (isConfiguredAddress(CONTRACTS.feeHandler)) {
          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.feeHandler,
                event: rewardsClaimedAndSwappedEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:rewards`,
                    kind: "rewards",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    actor: log.args.caller,
                    amountRaw: log.args.wethSwapped,
                    secondaryRaw: log.args.stremeOut,
                    label: "Rewards swapped",
                    detail: `${shortAddress(log.args.caller)} rebalanced LP rewards`,
                  });
                }
              }),
          );

          calls.push(
            publicClient
              .getLogs({
                address: CONTRACTS.feeHandler,
                event: flowRateRebalancedEvent,
                fromBlock: window.fromBlock,
                toBlock: window.toBlock,
              })
              .then((logs) => {
                for (const log of logs) {
                  rows.push({
                    id: `${log.transactionHash}:${log.logIndex}:flow`,
                    kind: "flow",
                    blockNumber: log.blockNumber,
                    logIndex: log.logIndex,
                    transactionHash: log.transactionHash,
                    actor: log.args.auction,
                    signedAmountRaw: log.args.flowRate,
                    label: "Flow rebalanced",
                    detail: `Stream target ${shortAddress(log.args.auction)}`,
                  });
                }
              }),
          );
        }

        await Promise.all(calls);
      }

      if (seq !== scanSeq.current) return;

      rows.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber < b.blockNumber ? 1 : -1;
        }
        return b.logIndex - a.logIndex;
      });

      setState({
        status: "ready",
        rows: rows.slice(0, MAX_ACTIVITY_ROWS),
        summary: summarizeActivity(rows),
        fromBlock: windows[windows.length - 1]?.fromBlock ?? latestBlock,
        latestBlock,
        scannedAt: Date.now(),
      });
    } catch (error) {
      if (seq !== scanSeq.current) return;
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Activity scan failed",
      }));
    }
  }, [publicClient]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), ACTIVITY_REFRESH_MS);
    return () => {
      scanSeq.current += 1;
      clearInterval(id);
    };
  }, [refresh]);

  return { ...state, refresh };
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const toneClass = {
    neutral: "border-white/10 bg-white/5 text-base-content/70",
    good: "border-success/30 bg-success/10 text-success",
    warn: "border-warning/30 bg-warning/10 text-warning",
    bad: "border-error/30 bg-error/10 text-error",
    info: "border-primary/30 bg-primary/10 text-primary",
  }[tone];

  const dotClass = {
    neutral: "bg-base-content/50",
    good: "bg-success",
    warn: "bg-warning",
    bad: "bg-error",
    info: "bg-primary",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "primary" | "secondary" | "accent" | "success" | "warning";
}) {
  const toneClass = {
    neutral: "border-white/10",
    primary: "border-primary/30",
    secondary: "border-secondary/30",
    accent: "border-accent/30",
    success: "border-success/30",
    warning: "border-warning/30",
  }[tone];

  return (
    <article
      className={`rounded-lg border ${toneClass} bg-base-200/70 p-4 shadow-[0_0_28px_rgba(0,0,0,0.24)] transition-colors duration-200 hover:bg-base-200`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
        {label}
      </div>
      <div className="mt-2 min-w-0 text-2xl font-semibold leading-tight text-base-content sm:text-3xl">
        {value}
      </div>
      {detail ? (
        <div className="mt-2 min-h-[1.25rem] text-sm text-base-content/58">
          {detail}
        </div>
      ) : null}
    </article>
  );
}

function SectionShell({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-base-200/55 p-4 shadow-[0_0_34px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-base-content">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddressRow({
  label,
  address,
}: {
  label: string;
  address?: string | null;
}) {
  const configured = isConfiguredAddress(address);
  return (
    <div className="grid gap-1 border-b border-white/5 py-3 last:border-b-0 sm:grid-cols-[170px_1fr_auto] sm:items-center">
      <div className="text-sm font-medium text-base-content/70">{label}</div>
      <div className="break-all font-mono text-xs text-base-content/55">
        {configured ? address : "Not configured"}
      </div>
      <StatusPill label={configured ? "Set" : "Missing"} tone={configured ? "good" : "warn"} />
    </div>
  );
}

function ActivityAmount({
  row,
  bidDecimals,
  bidSymbol,
  payoutDecimals,
  payoutSymbol,
}: {
  row: AdminActivity;
  bidDecimals: number;
  bidSymbol: string;
  payoutDecimals: number;
  payoutSymbol: string;
}) {
  if (row.kind === "bid" || row.kind === "settlement" || row.kind === "queue-bump") {
    return (
      <span>
        {formatTokenAmount(row.amountRaw, bidDecimals)} {bidSymbol}
      </span>
    );
  }
  if (row.kind === "gobble") {
    return (
      <span>
        {formatTokenAmount(row.amountRaw, payoutDecimals)} {payoutSymbol}
      </span>
    );
  }
  if (row.kind === "rewards") {
    return (
      <span>
        {formatTokenAmount(row.secondaryRaw, payoutDecimals)} {payoutSymbol}
      </span>
    );
  }
  if (row.kind === "flow") {
    return <span>{formatSignedTokenRate(row.signedAmountRaw, payoutDecimals)}</span>;
  }
  return <span className="text-base-content/35">--</span>;
}

function ActivityRow({
  row,
  bidDecimals,
  bidSymbol,
  payoutDecimals,
  payoutSymbol,
}: {
  row: AdminActivity;
  bidDecimals: number;
  bidSymbol: string;
  payoutDecimals: number;
  payoutSymbol: string;
}) {
  const toneClass = {
    bid: "bg-secondary",
    gobble: "bg-primary",
    settlement: "bg-success",
    queued: "bg-base-content/50",
    "queue-bump": "bg-accent",
    rewards: "bg-warning",
    flow: "bg-info",
  }[row.kind];

  return (
    <a
      href={txUrl(row.transactionHash)}
      target="_blank"
      rel="noreferrer"
      className="grid gap-3 border-b border-white/5 px-1 py-3 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:grid-cols-[minmax(0,1.4fr)_minmax(130px,0.65fr)_110px]"
    >
      <div className="flex min-w-0 gap-3">
        <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${toneClass}`} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-base-content">{row.label}</div>
          <div className="mt-0.5 truncate text-xs text-base-content/50">{row.detail}</div>
        </div>
      </div>
      <div className="font-mono text-sm text-base-content/75">
        <ActivityAmount
          row={row}
          bidDecimals={bidDecimals}
          bidSymbol={bidSymbol}
          payoutDecimals={payoutDecimals}
          payoutSymbol={payoutSymbol}
        />
      </div>
      <div className="font-mono text-xs text-base-content/45 sm:text-right">
        #{row.blockNumber.toString()}
      </div>
    </a>
  );
}

export default function AdminDashboard() {
  const nowUnix = useNowUnix();
  const priceQ = useDutchAuctionPrice();
  const payoutToken = useDutchAuctionPayoutToken();
  const payoutStream = useDutchAuctionPayoutStream(
    priceQ.data,
    payoutToken.decimals,
    priceQ.dataUpdatedAt,
  );
  const { priceUsd: warpgobbSpotUsd, isLoading: spotLoading } =
    useWarpgobbUsdPrice();

  const auction = useAuctionSellAuction();
  const queue = useAuctionSellQueue({
    enabled: true,
    excludeTokenId: auction.auction?.tokenId,
  });
  const activity = useAdminActivityScan();

  const feeHandlerConfigured = isConfiguredAddress(CONTRACTS.feeHandler);
  const auctionSellConfigured = auction.configured;
  const dutchAuctionConfigured = isConfiguredAddress(CONTRACTS.dutchAuction);
  const warpletsConfigured = isConfiguredAddress(CONTRACTS.warplets);
  const payoutTokenConfigured = isConfiguredAddress(payoutToken.address);

  const { data: queuedLength } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.auctionSell,
    abi: auctionSellAbi,
    functionName: "queuedLength",
    query: {
      enabled: auctionSellConfigured,
      refetchInterval: 5_000,
    },
  });

  const { data: proceedsRecipientRaw } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.auctionSell,
    abi: auctionSellAbi,
    functionName: "proceedsRecipient",
    query: {
      enabled: auctionSellConfigured,
      refetchInterval: 60_000,
    },
  });

  const proceedsRecipient = isConfiguredAddress(proceedsRecipientRaw)
    ? proceedsRecipientRaw
    : zeroAddress;

  const { data: durationSeconds } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.auctionSell,
    abi: auctionSellAbi,
    functionName: "duration",
    query: {
      enabled: auctionSellConfigured,
      refetchInterval: 60_000,
    },
  });

  const { data: timeBufferSeconds } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.auctionSell,
    abi: auctionSellAbi,
    functionName: "timeBuffer",
    query: {
      enabled: auctionSellConfigured,
      refetchInterval: 60_000,
    },
  });

  const { data: streamActive } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.feeHandler,
    abi: feeHandlerAbi,
    functionName: "streamActive",
    query: {
      enabled: feeHandlerConfigured,
      refetchInterval: 10_000,
    },
  });

  const { data: currentFlowRateRaw } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.feeHandler,
    abi: feeHandlerAbi,
    functionName: "currentFlowRate",
    query: {
      enabled: feeHandlerConfigured,
      refetchInterval: 10_000,
    },
  });

  const { data: previewFlowRateRaw } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.feeHandler,
    abi: feeHandlerAbi,
    functionName: "previewFlowRate",
    query: {
      enabled: feeHandlerConfigured,
      refetchInterval: 15_000,
    },
  });

  const { data: targetDurationSeconds } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.feeHandler,
    abi: feeHandlerAbi,
    functionName: "targetDuration",
    query: {
      enabled: feeHandlerConfigured,
      refetchInterval: 60_000,
    },
  });

  const { data: feeHandlerAuctionRaw } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.feeHandler,
    abi: feeHandlerAbi,
    functionName: "auction",
    query: {
      enabled: feeHandlerConfigured,
      refetchInterval: 60_000,
    },
  });

  const { data: auctionWarpletBalance } = useReadContract({
    chainId: base.id,
    address: CONTRACTS.warplets,
    abi: erc721Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.auctionSell],
    query: {
      enabled: warpletsConfigured && auctionSellConfigured,
      refetchInterval: 20_000,
    },
  });

  const { data: auctionBidEscrow } = useReadContract({
    chainId: base.id,
    address: auction.bidTokenAddress ?? zeroAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.auctionSell],
    query: {
      enabled: auctionSellConfigured && isConfiguredAddress(auction.bidTokenAddress),
      refetchInterval: 15_000,
    },
  });

  const { data: proceedsRecipientBalance } = useReadContract({
    chainId: base.id,
    address: auction.bidTokenAddress ?? zeroAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [proceedsRecipient],
    query: {
      enabled:
        auctionSellConfigured &&
        isConfiguredAddress(auction.bidTokenAddress) &&
        isConfiguredAddress(proceedsRecipient),
      refetchInterval: 30_000,
    },
  });

  const { data: feeHandlerTokenBalance } = useReadContract({
    chainId: base.id,
    address: payoutToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.feeHandler],
    query: {
      enabled: feeHandlerConfigured && payoutTokenConfigured,
      refetchInterval: 15_000,
    },
  });

  const liveLot = auction.auction;
  const liveAuctionActive =
    liveLot != null && liveLot.startTime > 0n && !liveLot.settled;
  const auctionExpired =
    liveAuctionActive && liveLot != null && BigInt(nowUnix) >= liveLot.endTime;
  const secondsToEnd =
    liveAuctionActive && liveLot != null
      ? Number(liveLot.endTime - BigInt(nowUnix))
      : null;
  const hasTopBid = liveLot != null && liveLot.amount > 0n;
  const queueDepth = queuedLength ?? BigInt(queue.data.length);
  const queuePreview = queue.data.slice(0, 6);

  const potAmount = useMemo(
    () => formatTokenAmount(priceQ.data, payoutToken.decimals, 4),
    [priceQ.data, payoutToken.decimals],
  );
  const potUsd = useMemo(() => {
    if (priceQ.data == null || warpgobbSpotUsd == null) return null;
    return Number(formatUnits(priceQ.data, payoutToken.decimals)) * warpgobbSpotUsd;
  }, [priceQ.data, payoutToken.decimals, warpgobbSpotUsd]);

  const streamRateRaw =
    currentFlowRateRaw ??
    activity.summary.latestFlowRate ??
    BigInt(Math.max(0, Math.round(payoutStream.perSecond * 10 ** payoutToken.decimals)));
  const streamRatePerDay =
    streamRateRaw == null ? undefined : streamRateRaw * 86_400n;
  const flowDrift =
    currentFlowRateRaw != null && previewFlowRateRaw != null
      ? previewFlowRateRaw - currentFlowRateRaw
      : undefined;

  const configuredCount = [
    feeHandlerConfigured,
    dutchAuctionConfigured,
    auctionSellConfigured,
    isConfiguredAddress(CONTRACTS.warplets),
    isConfiguredAddress(CONTRACTS.gobbledWarplets),
    isConfiguredAddress(CONTRACTS.warpgobbToken),
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen overflow-hidden bg-base-100 text-base-content">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(0,245,255,0.14),transparent_28%),radial-gradient(circle_at_82%_4%,rgba(255,0,122,0.12),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg border border-white/10 object-cover"
              priority
            />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Live Ops
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-normal text-base-content sm:text-3xl">
                WarpletGobbler Admin
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={`${configuredCount}/6 contracts`}
              tone={configuredCount >= 5 ? "good" : "warn"}
            />
            <StatusPill
              label={
                streamActive == null
                  ? feeHandlerConfigured
                    ? "Stream checking"
                    : "Stream unconfigured"
                  : streamActive
                    ? "Stream active"
                    : "Stream paused"
              }
              tone={streamActive ? "good" : feeHandlerConfigured ? "warn" : "neutral"}
            />
            <StatusPill
              label={
                auction.auctionPaused
                  ? "Auction paused"
                  : auctionExpired
                    ? "Auction ended"
                    : liveAuctionActive
                      ? "Auction live"
                      : "Auction idle"
              }
              tone={
                auction.auctionPaused
                  ? "warn"
                  : liveAuctionActive && !auctionExpired
                    ? "good"
                    : "neutral"
              }
            />
            <Link
              href="/"
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-base-content/75 transition-colors hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              Public app
            </Link>
            <ConnectButton />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gobbler pot"
            value={
              <span>
                {potAmount} <span className="text-base text-base-content/55">{payoutToken.symbol}</span>
              </span>
            }
            detail={potUsd != null ? `${formatUsd(potUsd)} at spot` : "Current drainable balance"}
            tone="primary"
          />
          <MetricCard
            label="Stream rate"
            value={
              <span>
                {formatSignedTokenRate(streamRateRaw, payoutToken.decimals)}
              </span>
            }
            detail={
              <span>
                {formatTokenAmount(streamRatePerDay, payoutToken.decimals, 2)} {payoutToken.symbol}/day
              </span>
            }
            tone={streamActive ? "success" : "warning"}
          />
          <MetricCard
            label={`${payoutToken.symbol} spot`}
            value={spotLoading ? "Loading" : formatUsd(warpgobbSpotUsd)}
            detail="Uniswap v4 pair x WETH/USDC"
            tone="secondary"
          />
          <MetricCard
            label="Active bid"
            value={
              <span>
                {formatTokenAmount(liveLot?.amount, auction.bidDecimals)}{" "}
                <span className="text-base text-base-content/55">{auction.bidSymbol}</span>
              </span>
            }
            detail={
              hasTopBid
                ? `${shortAddress(liveLot?.bidder)} leading on #${liveLot?.tokenId.toString()}`
                : liveAuctionActive
                  ? `No bids on #${liveLot?.tokenId.toString()}`
                  : "No live auction"
            }
            tone="accent"
          />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Warplets gobbled"
            value={formatWhole(activity.summary.gobbleCount)}
            detail={`${formatTokenAmount(activity.summary.gobblePayout, payoutToken.decimals, 2)} ${payoutToken.symbol} paid in scan`}
            tone="primary"
          />
          <MetricCard
            label="SUP distributions"
            value={
              <span>
                {formatTokenAmount(
                  activity.summary.settlementVolume + activity.summary.queueBumpFees,
                  auction.bidDecimals,
                  2,
                )}{" "}
                <span className="text-base text-base-content/55">{auction.bidSymbol}</span>
              </span>
            }
            detail={`${activity.summary.settlementCount} settlements, ${activity.summary.queueBumpCount} queue bumps`}
            tone="success"
          />
          <MetricCard
            label="Queue depth"
            value={formatWhole(queueDepth)}
            detail={
              queuePreview.length > 0
                ? `Next: ${queuePreview.map((id) => `#${id.toString()}`).join(", ")}`
                : queue.isLoading
                  ? "Loading queued Warplets"
                  : "No queued Warplets"
            }
            tone="secondary"
          />
          <MetricCard
            label="Auction custody"
            value={formatWhole(auctionWarpletBalance)}
            detail={`${formatTokenAmount(auctionBidEscrow, auction.bidDecimals, 2)} ${auction.bidSymbol} bid escrow`}
            tone="neutral"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="flex flex-col gap-6">
            <SectionShell
              title="Auction"
              eyebrow="Sell side"
              action={
                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={auction.nativeEthBidConfigured ? "ETH bids enabled" : "Token bids only"}
                    tone={auction.nativeEthBidConfigured ? "good" : "neutral"}
                  />
                  <StatusPill
                    label={auction.auctionPaused ? "Paused" : "Unpaused"}
                    tone={auction.auctionPaused ? "warn" : "good"}
                  />
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Lot"
                  value={liveLot?.tokenId != null ? `#${liveLot.tokenId.toString()}` : "--"}
                  detail={
                    liveAuctionActive
                      ? auctionExpired
                        ? "Ready to settle"
                        : `${formatDuration(secondsToEnd)} remaining`
                      : "No active lot"
                  }
                  tone={auctionExpired ? "warning" : "neutral"}
                />
                <MetricCard
                  label="Minimum next bid"
                  value={
                    <span>
                      {formatTokenAmount(auction.minNextBidAmount, auction.bidDecimals)}{" "}
                      <span className="text-base text-base-content/55">{auction.bidSymbol}</span>
                    </span>
                  }
                  detail={`Reserve ${formatTokenAmount(auction.reservePrice, auction.bidDecimals)} ${auction.bidSymbol}`}
                  tone="secondary"
                />
                <MetricCard
                  label="Rules"
                  value={formatDuration(durationSeconds)}
                  detail={`Buffer ${formatDuration(timeBufferSeconds)} - bump ${auction.skipQueueFeeAmountStr ?? "--"} ${auction.bidSymbol}`}
                  tone="neutral"
                />
              </div>
            </SectionShell>

            <SectionShell
              title="Recent Activity"
              eyebrow="Bids, gobbles, stream"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={activity.status === "loading" ? "Refreshing" : formatScanAge(activity.scannedAt)}
                    tone={activity.status === "error" ? "bad" : activity.status === "loading" ? "info" : "good"}
                  />
                  <button
                    type="button"
                    onClick={() => void activity.refresh()}
                    className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-base-content/75 transition-colors hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    Refresh
                  </button>
                </div>
              }
            >
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-base-content/45">
                <span>Range {formatBlockRange(activity.fromBlock, activity.latestBlock)}</span>
                <span>Lookback {ADMIN_LOG_LOOKBACK_BLOCKS.toLocaleString()} blocks</span>
                <span>{activity.summary.bidCount.toLocaleString()} bids scanned</span>
              </div>
              {activity.error ? (
                <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
                  {activity.error}
                </div>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-white/5 bg-base-100/35">
                {activity.rows.length > 0 ? (
                  activity.rows.map((row) => (
                    <ActivityRow
                      key={row.id}
                      row={row}
                      bidDecimals={auction.bidDecimals}
                      bidSymbol={auction.bidSymbol}
                      payoutDecimals={payoutToken.decimals}
                      payoutSymbol={payoutToken.symbol}
                    />
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-base-content/50">
                    {activity.status === "loading"
                      ? "Scanning recent logs"
                      : "No recent activity in the scanned range"}
                  </div>
                )}
              </div>
            </SectionShell>
          </div>

          <div className="flex flex-col gap-6">
            <SectionShell title="Stream" eyebrow="Fee handler">
              <div className="space-y-3">
                <MetricCard
                  label="Handler balance"
                  value={
                    <span>
                      {formatTokenAmount(feeHandlerTokenBalance, payoutToken.decimals, 2)}{" "}
                      <span className="text-base text-base-content/55">{payoutToken.symbol}</span>
                    </span>
                  }
                  detail={`Target ${formatDuration(targetDurationSeconds)}`}
                  tone="primary"
                />
                <MetricCard
                  label="Preview delta"
                  value={formatSignedTokenRate(flowDrift, payoutToken.decimals)}
                  detail={`FeeHandler points to ${shortAddress(feeHandlerAuctionRaw)}`}
                  tone="neutral"
                />
                <MetricCard
                  label="Rewards converted"
                  value={
                    <span>
                      {formatTokenAmount(activity.summary.stremeOut, payoutToken.decimals, 2)}{" "}
                      <span className="text-base text-base-content/55">{payoutToken.symbol}</span>
                    </span>
                  }
                  detail={`${activity.summary.rewardCount} reward events in scan`}
                  tone="success"
                />
              </div>
            </SectionShell>

            <SectionShell title="SUP / Staking" eyebrow="Proceeds">
              <div className="space-y-3">
                <MetricCard
                  label="Recipient balance"
                  value={
                    <span>
                      {formatTokenAmount(proceedsRecipientBalance, auction.bidDecimals, 2)}{" "}
                      <span className="text-base text-base-content/55">{auction.bidSymbol}</span>
                    </span>
                  }
                  detail={shortAddress(proceedsRecipient)}
                  tone="success"
                />
                <MetricCard
                  label="Settled proceeds"
                  value={
                    <span>
                      {formatTokenAmount(activity.summary.settlementVolume, auction.bidDecimals, 2)}{" "}
                      <span className="text-base text-base-content/55">{auction.bidSymbol}</span>
                    </span>
                  }
                  detail="Auction wins routed in scan"
                  tone="secondary"
                />
              </div>
            </SectionShell>

            <SectionShell title="Contracts" eyebrow="Config">
              <div className="rounded-lg border border-white/5 bg-base-100/35 px-3">
                <AddressRow label="FeeHandler" address={CONTRACTS.feeHandler} />
                <AddressRow label="DutchAuction" address={CONTRACTS.dutchAuction} />
                <AddressRow label="AuctionSell" address={CONTRACTS.auctionSell} />
                <AddressRow label="Warplets" address={CONTRACTS.warplets} />
                <AddressRow label="Gobbled receipts" address={CONTRACTS.gobbledWarplets} />
                <AddressRow label="Staking" address={CONTRACTS.staking} />
                <AddressRow label="Proceeds recipient" address={proceedsRecipient} />
              </div>
            </SectionShell>
          </div>
        </div>
      </div>
    </main>
  );
}
