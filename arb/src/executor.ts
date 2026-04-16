import {
  type Address,
  type WalletClient,
  type Hash,
  formatEther,
} from "viem";
import { gobbleSniperAbi } from "./abi.js";
import {
  GOBBLE_SNIPER_ADDRESS,
  DRY_RUN,
  MIN_PROFIT_WEI,
  GAS_BUFFER_BPS,
} from "./config.js";
import { getFulfillment, type FulfillmentData } from "./opensea.js";
import type { AnyPublicClient, Opportunity } from "./pricing.js";
import { log } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  simulated?: boolean;
}

type SnipeArgs = readonly [bigint, `0x${string}`, bigint, bigint, bigint];

// ─── Build snipe args ─────────────────────────────────────────────────

/**
 * Fetch fulfillment data and build the `snipe` contract args.
 * Returns null if OpenSea fulfillment fails.
 */
async function buildSnipeArgs(
  opp: Opportunity,
  sniperAddress: Address,
): Promise<{ args: SnipeArgs; fulfillment: FulfillmentData } | null> {
  const fulfillment = await getFulfillment(opp.listing, sniperAddress);
  if (!fulfillment) return null;

  // Slippage guard on gobble payout: accept 5% less than current pot reading.
  const minGobblePayout = (opp.gobblePayout * 95n) / 100n;

  const args: SnipeArgs = [
    BigInt(opp.listing.tokenId),
    fulfillment.data,
    fulfillment.value,
    minGobblePayout,
    MIN_PROFIT_WEI,
  ];
  return { args, fulfillment };
}

// ─── Simulate (using already-built args) ─────────────────────────────

async function simulateWithArgs(
  client: AnyPublicClient,
  sniperAddress: Address,
  botAddress: Address,
  args: SnipeArgs,
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.simulateContract({
      address: sniperAddress,
      abi: gobbleSniperAbi,
      functionName: "snipe",
      args,
      account: botAddress,
    });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ─── Execute ──────────────────────────────────────────────────────────

export async function executeSnipe(
  publicClient: AnyPublicClient,
  walletClient: WalletClient,
  opp: Opportunity,
): Promise<ExecutionResult> {
  const sniperAddress = GOBBLE_SNIPER_ADDRESS;
  const botAddress = walletClient.account!.address;

  log.info("Preparing flash-gobble snipe", {
    tokenId: opp.listing.tokenId,
    listingPrice: formatEther(opp.listing.priceWei),
    netProfit: formatEther(opp.netProfit),
  });

  // 1. Build args once — reused across simulate, gas estimate, and send
  const built = await buildSnipeArgs(opp, sniperAddress);
  if (!built) {
    return { success: false, error: "Failed to get fulfillment data" };
  }

  // 2. Simulate with the same args
  log.info("Simulating snipe tx...");
  const sim = await simulateWithArgs(publicClient, sniperAddress, botAddress, built.args);
  if (!sim.success) {
    log.warn("Simulation failed", { error: sim.error });
    return { success: false, error: `Simulation failed: ${sim.error}`, simulated: true };
  }
  log.info("Simulation passed");

  // 3. Dry run check
  if (DRY_RUN) {
    log.info("DRY RUN — would have executed snipe", {
      tokenId: opp.listing.tokenId,
      ethForNft: formatEther(built.fulfillment.value),
      minProfit: formatEther(MIN_PROFIT_WEI),
    });
    return { success: true, simulated: true };
  }

  // 4. Estimate gas (reuse args)
  let gasEstimate: bigint;
  try {
    gasEstimate = await publicClient.estimateContractGas({
      address: sniperAddress,
      abi: gobbleSniperAbi,
      functionName: "snipe",
      args: built.args,
      account: botAddress,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Gas estimation failed: ${msg}` };
  }

  // Stay in bigint — no float conversions.
  const gasLimit = (gasEstimate * GAS_BUFFER_BPS) / 10_000n;

  // 5. Send tx — no msg.value needed, flash gobble is capital-free
  log.info("Sending snipe tx", { gasLimit: gasLimit.toString() });
  try {
    const hash = await walletClient.writeContract({
      address: sniperAddress,
      abi: gobbleSniperAbi,
      functionName: "snipe",
      args: built.args,
      gas: gasLimit,
      chain: walletClient.chain,
      account: walletClient.account!,
    });

    log.info("Snipe tx sent", { hash });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status === "success") {
      log.info("SNIPE SUCCESS", {
        hash,
        tokenId: opp.listing.tokenId,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      });
      return { success: true, txHash: hash };
    } else {
      log.error("Snipe tx reverted", { hash });
      return { success: false, txHash: hash, error: "Transaction reverted" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Snipe tx failed", { error: msg });
    return { success: false, error: msg };
  }
}
