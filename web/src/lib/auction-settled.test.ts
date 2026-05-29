import { describe, it, expect } from "vitest";
import {
  type Address,
  type TransactionReceipt,
  encodeAbiParameters,
  encodeEventTopics,
} from "viem";
import { auctionSellAbi } from "@/abi/auctionSell";
import {
  attachGobbledTokenId,
  auctionSettledGobbledTokenId,
} from "./auction-settled";
import {
  getWinnerFingerprint,
  type StoredWinnerHighlight,
} from "./settlement-records";

const ALICE = "0x1111111111111111111111111111111111111111" as Address;
const BOB = "0x2222222222222222222222222222222222222222" as Address;
const AUCTION = "0x3333333333333333333333333333333333333333" as Address;

/** Build a real encoded AuctionSettled log so parseEventLogs actually decodes it. */
function settledLog(args: {
  tokenId: bigint;
  winner: Address;
  amount: bigint;
  gobbledTokenId: bigint;
}) {
  const topics = encodeEventTopics({
    abi: auctionSellAbi,
    eventName: "AuctionSettled",
    args: { tokenId: args.tokenId, winner: args.winner },
  });
  const data = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    [args.amount, args.gobbledTokenId],
  );
  return { address: AUCTION, topics, data };
}

function receiptWith(
  logs: ReturnType<typeof settledLog>[],
): TransactionReceipt {
  return { logs } as unknown as TransactionReceipt;
}

function snap(over: Partial<StoredWinnerHighlight> = {}): StoredWinnerHighlight {
  return {
    fp: getWinnerFingerprint(42n, ALICE, 1000n),
    tokenId: 42,
    bidder: ALICE,
    amountWei: "1000",
    ...over,
  };
}

describe("auctionSettledGobbledTokenId", () => {
  it("returns undefined for a null receipt or null snapshot", () => {
    expect(auctionSettledGobbledTokenId(null, snap())).toBeUndefined();
    expect(
      auctionSettledGobbledTokenId(receiptWith([]), null),
    ).toBeUndefined();
  });

  it("extracts the gobbledTokenId from the matching AuctionSettled log", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 42n,
        winner: ALICE,
        amount: 1000n,
        gobbledTokenId: 200000042n,
      }),
    ]);
    expect(auctionSettledGobbledTokenId(receipt, snap())).toBe("200000042");
  });

  it("returns undefined when no log matches the lot (different bidder)", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 42n,
        winner: BOB,
        amount: 1000n,
        gobbledTokenId: 200000042n,
      }),
    ]);
    expect(auctionSettledGobbledTokenId(receipt, snap())).toBeUndefined();
  });

  it("picks the log matching tokenId + winner + amount among several", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 7n,
        winner: BOB,
        amount: 5n,
        gobbledTokenId: 7n,
      }),
      settledLog({
        tokenId: 42n,
        winner: ALICE,
        amount: 1000n,
        gobbledTokenId: 200000042n,
      }),
    ]);
    expect(auctionSettledGobbledTokenId(receipt, snap())).toBe("200000042");
  });

  it("does not match on tokenId + winner alone when the amount differs", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 42n,
        winner: ALICE,
        amount: 999n,
        gobbledTokenId: 200000042n,
      }),
    ]);
    expect(auctionSettledGobbledTokenId(receipt, snap())).toBeUndefined();
  });

  it("returns undefined (not throw) when logs can't be decoded", () => {
    const garbage = {
      logs: [{ address: AUCTION, topics: ["0xdead"], data: "0x" }],
    } as unknown as TransactionReceipt;
    expect(auctionSettledGobbledTokenId(garbage, snap())).toBeUndefined();
  });
});

describe("attachGobbledTokenId", () => {
  it("upgrades the snapshot with the exact id and a receipt-aware fingerprint", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 42n,
        winner: ALICE,
        amount: 1000n,
        gobbledTokenId: 200000042n,
      }),
    ]);
    const upgraded = attachGobbledTokenId(snap(), receipt);
    expect(upgraded?.gobbledTokenId).toBe("200000042");
    expect(upgraded?.fp).toBe(
      getWinnerFingerprint(42n, ALICE, 1000n, 200000042n),
    );
  });

  it("is a no-op when the receipt yields no matching log", () => {
    const receipt = receiptWith([
      settledLog({
        tokenId: 99n,
        winner: ALICE,
        amount: 1000n,
        gobbledTokenId: 99n,
      }),
    ]);
    const input = snap();
    expect(attachGobbledTokenId(input, receipt)).toBe(input);
  });

  it("returns the snapshot unchanged when receipt is null", () => {
    const input = snap();
    expect(attachGobbledTokenId(input, null)).toBe(input);
  });
});
