import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBidQuoteDiscount,
  applyEthQuoteBuffer,
  quoteMinEthForZapBid,
} from "./stremeZapEthQuote";

const ACCOUNT = "0x0000000000000000000000000000000000000001";
const ZAP = "0x0000000000000000000000000000000000000002";
const BID_TOKEN = "0x0000000000000000000000000000000000000003";

describe("streme zap ETH quote helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a buffer to minimum ETH quotes", () => {
    expect(applyEthQuoteBuffer(1_000_000n, 300n)).toBe(1_030_000n);
  });

  it("discounts expected bid-token output for ETH spend quotes", () => {
    expect(applyBidQuoteDiscount(1_000_000n, 300n)).toBe(970_000n);
  });

  it("never returns negative bid output for oversized discounts", () => {
    expect(applyBidQuoteDiscount(1_000_000n, 10_000n)).toBe(0n);
    expect(applyBidQuoteDiscount(1_000_000n, 12_000n)).toBe(0n);
  });

  it("estimates required ETH above the connected wallet balance", async () => {
    const walletBalanceWei = 100_000_000_000n;
    const client = {
      simulateContract: async ({
        value,
        stateOverride,
      }: {
        value?: bigint;
        stateOverride?: Array<{ address: string; balance?: bigint }>;
      }) => {
        const ethWei = value ?? 0n;
        const simulatedBalance = stateOverride?.[0]?.balance ?? walletBalanceWei;
        if (ethWei > simulatedBalance) {
          throw new Error("insufficient funds for transfer");
        }
        return { result: ethWei * 10n };
      },
    };

    const quote = await quoteMinEthForZapBid(
      // PublicClient has a much wider surface than this helper needs.
      client as never,
      ACCOUNT,
      ZAP,
      BID_TOKEN,
      1_800_000_000_000n,
    );

    expect(quote).not.toBeNull();
    expect(quote!.minEthWei).toBeGreaterThan(walletBalanceWei);
    expect(quote!.expectedOutWei).toBeGreaterThanOrEqual(1_800_000_000_000n);
  });

  it("does not warn for expected under-minimum quote probes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const minEthWei = 200_000_000_000n;
    const client = {
      simulateContract: async ({ value }: { value?: bigint }) => {
        const ethWei = value ?? 0n;
        if (ethWei < minEthWei) {
          throw new Error("execution reverted");
        }
        return { result: 1_900_000_000_000n };
      },
    };

    const quote = await quoteMinEthForZapBid(
      // PublicClient has a much wider surface than this helper needs.
      client as never,
      ACCOUNT,
      ZAP,
      BID_TOKEN,
      1_800_000_000_000n,
    );

    expect(quote).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
