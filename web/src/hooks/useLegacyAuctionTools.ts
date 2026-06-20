"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatUnits,
  isAddress,
  isAddressEqual,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { auctionSellAbi } from "@/abi/auctionSell";
import { erc20Abi } from "@/abi/erc20";
import { erc777Abi } from "@/abi/erc777";
import { gobbledWarpletsAbi } from "@/abi/gobbledWarplets";
import { warpletsErc721EnumerableAbi } from "@/lib/warplets-abi";
import {
  classifyLegacyHeldWarplets,
  legacyMinNextBidWei,
  LEGACY_AUCTION_SELL_ADDRESS,
  LEGACY_GOBBLED_WARPLETS_ADDRESS,
  LEGACY_WARPGOBB_TOKEN_ADDRESS,
  LEGACY_WARPLETS_ADDRESS,
  type LegacyCurrentAuction,
} from "@/lib/legacy-auction";
import { AUCTION_BID_TOKEN_SYMBOL } from "@/lib/paymentToken";
import { formatUserFacingTxError } from "@/lib/format-tx-error";

type ReadResult = { status?: string; result?: unknown };

const LEGACY_SETTLEMENT_SCAN_FLOOR = 47_517_000n;
const LEGACY_SETTLEMENT_SCAN_CHUNK = 9_000n;

export type LegacyAuctionTxStage =
  | "idle"
  | "signing"
  | "confirming"
  | "syncing";
export type LegacyAuctionAction =
  | "bid"
  | "settle-start-next"
  | "extend"
  | `rescue-${string}`;

async function findLegacySettlementForToken(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  tokenId: bigint,
) {
  const latest = await publicClient.getBlockNumber();
  let toBlock = latest;

  while (toBlock >= LEGACY_SETTLEMENT_SCAN_FLOOR) {
    const fromBlock =
      toBlock - LEGACY_SETTLEMENT_SCAN_CHUNK + 1n > LEGACY_SETTLEMENT_SCAN_FLOOR
        ? toBlock - LEGACY_SETTLEMENT_SCAN_CHUNK + 1n
        : LEGACY_SETTLEMENT_SCAN_FLOOR;
    const logs = await publicClient.getContractEvents({
      address: LEGACY_AUCTION_SELL_ADDRESS,
      abi: auctionSellAbi,
      eventName: "AuctionSettled",
      args: { tokenId },
      fromBlock,
      toBlock,
    });
    if (logs.length > 0) return logs[logs.length - 1];
    if (fromBlock === LEGACY_SETTLEMENT_SCAN_FLOOR) break;
    toBlock = fromBlock - 1n;
  }

  return null;
}

export function useLegacyAuctionTools() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync, isPending: isWalletPending } =
    useWriteContract();
  const [activeAction, setActiveAction] =
    useState<LegacyAuctionAction | null>(null);
  const [txStage, setTxStage] = useState<LegacyAuctionTxStage>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [settledRescueByToken, setSettledRescueByToken] = useState<
    Record<string, { winner: Address; amountWei: string; gobbledTokenId: string }>
  >({});

  const currentAuctionQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "currentAuction",
    query: { refetchInterval: 10_000 },
  });

  const queueQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "getQueuedTokenIds",
    query: { refetchInterval: 10_000 },
  });

  const reserveQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "reservePrice",
    query: { refetchInterval: 30_000 },
  });

  const incrementPctQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "minBidIncrementPercentage",
    query: { refetchInterval: 30_000 },
  });

  const pausedQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "paused",
    query: { refetchInterval: 12_000 },
  });

  const bidTokenQ = useReadContract({
    chainId: base.id,
    address: LEGACY_AUCTION_SELL_ADDRESS,
    abi: auctionSellAbi,
    functionName: "bidToken",
    query: { refetchInterval: 60_000 },
  });

  const bidTokenAddress = useMemo<Address>(() => {
    const raw = bidTokenQ.data;
    if (
      typeof raw === "string" &&
      isAddress(raw) &&
      !isAddressEqual(raw, zeroAddress)
    ) {
      return raw as Address;
    }
    return LEGACY_WARPGOBB_TOKEN_ADDRESS;
  }, [bidTokenQ.data]);

  const decimalsQ = useReadContract({
    chainId: base.id,
    address: bidTokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !isAddressEqual(bidTokenAddress, zeroAddress) },
  });

  const symbolQ = useReadContract({
    chainId: base.id,
    address: bidTokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !isAddressEqual(bidTokenAddress, zeroAddress) },
  });

  const heldBalanceQ = useReadContract({
    chainId: base.id,
    address: LEGACY_WARPLETS_ADDRESS,
    abi: warpletsErc721EnumerableAbi,
    functionName: "balanceOf",
    args: [LEGACY_AUCTION_SELL_ADDRESS],
    query: { refetchInterval: 10_000 },
  });

  const heldBalanceCount = useMemo(() => {
    if (typeof heldBalanceQ.data !== "bigint") return 0;
    if (heldBalanceQ.data > BigInt(Number.MAX_SAFE_INTEGER)) return 0;
    return Number(heldBalanceQ.data);
  }, [heldBalanceQ.data]);

  const heldTokenContracts = useMemo(
    () =>
      Array.from({ length: heldBalanceCount }, (_, index) => ({
        chainId: base.id,
        address: LEGACY_WARPLETS_ADDRESS,
        abi: warpletsErc721EnumerableAbi,
        functionName: "tokenOfOwnerByIndex",
        args: [LEGACY_AUCTION_SELL_ADDRESS, BigInt(index)],
      })),
    [heldBalanceCount],
  );

  const heldTokenIdsQ = useReadContracts({
    contracts: heldTokenContracts,
    query: {
      enabled: heldBalanceCount > 0,
      refetchInterval: 10_000,
    },
  });

  const currentAuction = useMemo((): LegacyCurrentAuction | null => {
    const data = currentAuctionQ.data;
    if (data == null) return null;
    const [tokenId, highBidder, highBid, endTime] = data as readonly [
      bigint,
      Address,
      bigint,
      bigint,
    ];
    return { tokenId, highBidder, highBid, endTime };
  }, [currentAuctionQ.data]);

  const queuedTokenIds = useMemo((): bigint[] => {
    const data = queueQ.data;
    return Array.isArray(data) ? [...data] : [];
  }, [queueQ.data]);

  const heldTokenIds = useMemo((): bigint[] => {
    const reads = heldTokenIdsQ.data as readonly ReadResult[] | undefined;
    if (!reads) return [];
    return reads.flatMap((read) =>
      read?.status === "success" && typeof read.result === "bigint"
        ? [read.result]
        : [],
    );
  }, [heldTokenIdsQ.data]);

  const heldTokenIdsComplete =
    heldBalanceQ.isSuccess &&
    (heldBalanceCount === 0 ||
      (heldTokenIdsQ.data != null &&
        heldTokenIdsQ.data.length === heldBalanceCount &&
        heldTokenIdsQ.data.every((read) => read?.status === "success")));

  const heldWarplets = useMemo(
    () =>
      classifyLegacyHeldWarplets({
        heldTokenIds,
        currentTokenId:
          currentAuction != null && currentAuction.tokenId > 0n
            ? currentAuction.tokenId
            : null,
        queuedTokenIds,
      }),
    [currentAuction, heldTokenIds, queuedTokenIds],
  );

  const rescueCandidates = useMemo(
    () =>
      heldWarplets.filter(
        (warplet) => warplet.status === "held-needs-rescue-check",
      ),
    [heldWarplets],
  );

  useEffect(() => {
    if (!publicClient || rescueCandidates.length === 0) {
      setSettledRescueByToken({});
      return;
    }

    let cancelled = false;
    void Promise.allSettled(
      rescueCandidates.map((warplet) =>
        findLegacySettlementForToken(publicClient, warplet.tokenId),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<
          string,
          { winner: Address; amountWei: string; gobbledTokenId: string }
        > = {};

        for (const result of results) {
          if (result.status !== "fulfilled" || result.value == null) continue;
          const tokenId = result.value.args.tokenId?.toString();
          const winner = result.value.args.winner;
          const amount = result.value.args.amount;
          const gobbledTokenId = result.value.args.gobbledTokenId;
          if (
            tokenId == null ||
            winner == null ||
            amount == null ||
            gobbledTokenId == null
          ) {
            continue;
          }
          next[tokenId] = {
            winner,
            amountWei: amount.toString(),
            gobbledTokenId: gobbledTokenId.toString(),
          };
        }

        setSettledRescueByToken(next);
      })
      .catch(() => {
        if (!cancelled) setSettledRescueByToken({});
      });

    return () => {
      cancelled = true;
    };
  }, [publicClient, rescueCandidates]);

  const bidDecimals = Number(decimalsQ.data ?? 18);
  const bidSymbol =
    typeof symbolQ.data === "string" && symbolQ.data.trim()
      ? symbolQ.data.trim()
      : AUCTION_BID_TOKEN_SYMBOL;

  const minNextBidWei = useMemo(() => {
    if (
      currentAuction == null ||
      reserveQ.data === undefined ||
      incrementPctQ.data === undefined
    ) {
      return null;
    }
    return legacyMinNextBidWei(
      currentAuction.highBid,
      reserveQ.data,
      Number(incrementPctQ.data),
    );
  }, [currentAuction, incrementPctQ.data, reserveQ.data]);

  const parseBidAmount = useCallback(
    (human: string) =>
      parseUnits(human.replace(/,/g, "").trim() || "0", bidDecimals),
    [bidDecimals],
  );

  const formatBidAmount = useCallback(
    (amount: bigint, maxFractionDigits = 4) =>
      Number(formatUnits(amount, bidDecimals)).toLocaleString(undefined, {
        maximumFractionDigits: maxFractionDigits,
      }),
    [bidDecimals],
  );

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      currentAuctionQ.refetch(),
      queueQ.refetch(),
      reserveQ.refetch(),
      incrementPctQ.refetch(),
      pausedQ.refetch(),
      bidTokenQ.refetch(),
      heldBalanceQ.refetch(),
      heldTokenIdsQ.refetch(),
    ]);
  }, [
    bidTokenQ,
    currentAuctionQ,
    heldBalanceQ,
    heldTokenIdsQ,
    incrementPctQ,
    pausedQ,
    queueQ,
    reserveQ,
  ]);

  const runLegacyWrite = useCallback(
    async (
      action: LegacyAuctionAction,
      write: () => Promise<Hash>,
    ): Promise<Hash | null> => {
      if (!isConnected || address == null) {
        setTxError("Connect a wallet to submit this legacy transaction.");
        return null;
      }
      if (!publicClient) {
        setTxError("Base RPC is not ready. Try again in a moment.");
        return null;
      }

      setActiveAction(action);
      setTxStage("signing");
      setTxHash(null);
      setTxError(null);
      try {
        const hash = await write();
        setTxHash(hash);
        setTxStage("confirming");
        await publicClient.waitForTransactionReceipt({ hash });
        setTxStage("syncing");
        await refetchAll();
        return hash;
      } catch (error) {
        setTxError(formatUserFacingTxError(error));
        return null;
      } finally {
        setActiveAction(null);
        setTxStage("idle");
      }
    },
    [address, isConnected, publicClient, refetchAll],
  );

  const bid = useCallback(
    async (amountWei: bigint) => {
      if (amountWei <= 0n) {
        setTxError("Enter a bid amount greater than zero.");
        return null;
      }
      return runLegacyWrite("bid", () =>
        writeContractAsync({
          chainId: base.id,
          address: bidTokenAddress,
          abi: erc777Abi,
          functionName: "send",
          args: [LEGACY_AUCTION_SELL_ADDRESS, amountWei, "0x"],
        }),
      );
    },
    [bidTokenAddress, runLegacyWrite, writeContractAsync],
  );

  const settleAndStartNext = useCallback(
    async () =>
      runLegacyWrite("settle-start-next", () =>
        writeContractAsync({
          chainId: base.id,
          address: LEGACY_AUCTION_SELL_ADDRESS,
          abi: auctionSellAbi,
          functionName: "settleCurrentAndCreateNewAuction",
        }),
      ),
    [runLegacyWrite, writeContractAsync],
  );

  const extendAuction = useCallback(
    async () =>
      runLegacyWrite("extend", () =>
        writeContractAsync({
          chainId: base.id,
          address: LEGACY_AUCTION_SELL_ADDRESS,
          abi: auctionSellAbi,
          functionName: "extendAuction",
        }),
      ),
    [runLegacyWrite, writeContractAsync],
  );

  const rescueWarplet = useCallback(
    async (warpletId: bigint) =>
      runLegacyWrite(`rescue-${warpletId.toString()}`, () =>
        writeContractAsync({
          chainId: base.id,
          address: LEGACY_GOBBLED_WARPLETS_ADDRESS,
          abi: gobbledWarpletsAbi,
          functionName: "rescueWarplet",
          args: [warpletId],
        }),
      ),
    [runLegacyWrite, writeContractAsync],
  );

  const isReading =
    currentAuctionQ.isLoading ||
    queueQ.isLoading ||
    reserveQ.isLoading ||
    incrementPctQ.isLoading ||
    pausedQ.isLoading ||
    heldBalanceQ.isLoading ||
    (heldBalanceCount > 0 && !heldTokenIdsComplete);

  const readError =
    currentAuctionQ.isError ||
    queueQ.isError ||
    reserveQ.isError ||
    incrementPctQ.isError ||
    pausedQ.isError ||
    heldBalanceQ.isError ||
    heldTokenIdsQ.isError;

  return {
    address,
    isConnected,
    auctionAddress: LEGACY_AUCTION_SELL_ADDRESS,
    gobbledWarpletsAddress: LEGACY_GOBBLED_WARPLETS_ADDRESS,
    warpletsAddress: LEGACY_WARPLETS_ADDRESS,
    bidTokenAddress,
    currentAuction,
    queuedTokenIds,
    heldTokenIds,
    heldWarplets,
    rescueCandidates,
    settledRescueByToken,
    heldBalance: heldBalanceQ.data ?? 0n,
    paused: pausedQ.data === true,
    reservePriceWei: reserveQ.data ?? null,
    minBidIncrementPct:
      incrementPctQ.data === undefined ? null : Number(incrementPctQ.data),
    minNextBidWei,
    bidDecimals,
    bidSymbol,
    parseBidAmount,
    formatBidAmount,
    bid,
    settleAndStartNext,
    extendAuction,
    rescueWarplet,
    refetchAll,
    isReading,
    readError,
    isTxPending: txStage !== "idle" || isWalletPending,
    activeAction,
    txStage,
    txHash,
    txError,
    clearTxError: () => setTxError(null),
  };
}
