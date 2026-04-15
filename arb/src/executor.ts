import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hash,
  formatEther,
} from "viem";
import { gobbleSniperAbi } from "./abi.js";
import {
  GOBBLE_SNIPER_ADDRESS,
  DRY_RUN,
  MIN_PROFIT_WEI,
  GAS_BUFFER,
} from "./config.js";
import { getFulfillment } from "./opensea.js";
import type { Opportunity } from "./pricing.js";
import { log } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  simulated?: boolean;
}

// ─── Build snipe args ─────────────────────────────────────────────────

async function buildSnipeArgs(opp: Opportunity, sniperAddress: Address) {
  const fulfillment = await getFulfillment(opp.listing, sniperAddress);
  if (!fulfillment) return null;

  return {
    args: [
      BigInt(opp.listing.tokenId),
      fulfillment.data,
      fulfillment.value,
      MIN_PROFIT_WEI,
    ] as const,
    fulfillment,
  };
}

// ─── Simulate ─────────────────────────────────────────────────────────

export async function simulateSnipe(
  client: PublicClient,
  opp: Opportunity,
  sniperAddress: Address,
  botAddress: Address,
): Promise<{ success: boolean; error?: string }> {
  const built = await buildSnipeArgs(opp, sniperAddress);
  if (!built) return { success: false, error: "Failed to get OpenSea fulfillment data" };

  try {
    await client.simulateContract({
      address: sniperAddress,
      abi: gobbleSniperAbi,
      functionName: "snipe",
      args: built.args,
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
  publicClient: PublicClient,
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

  // 1. Build args (fetches fulfillment data)
  const built = await buildSnipeArgs(opp, sniperAddress);
  if (!built) {
    return { success: false, error: "Failed to get fulfillment data" };
  }

  // 2. Simulate
  log.info("Simulating snipe tx...");
  const sim = await simulateSnipe(publicClient, opp, sniperAddress, botAddress);
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

  // 4. Estimate gas
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

  const gasLimit = BigInt(Math.ceil(Number(gasEstimate) * GAS_BUFFER));

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
