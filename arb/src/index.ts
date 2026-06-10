import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  BASE_RPC_URL,
  BASE_PRIVATE_RPC_URL,
  BOT_PRIVATE_KEY,
  CHAIN,
  DRY_RUN,
  POLL_INTERVAL_MS,
  GOBBLE_SNIPER_ADDRESS,
  DUTCH_AUCTION_ADDRESS,
  WARPGOBB_TOKEN_ADDRESS,
  WETH_ADDRESS,
  MIN_PROFIT_WEI,
  MAX_SPEND_WEI,
} from "./config.js";
import { fetchListings } from "./opensea.js";
import { evaluateOpportunity, getGobblePayout } from "./pricing.js";
import { executeSnipe } from "./executor.js";
import { log } from "./logger.js";

// ─── Setup ────────────────────────────────────────────────────────────

const account = privateKeyToAccount(BOT_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(BASE_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: CHAIN,
  transport: http(BASE_PRIVATE_RPC_URL ?? BASE_RPC_URL),
});

// Track recently attempted listings to avoid hammering the same ones
const recentlyAttempted = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown per listing

/** Drop expired cooldown entries so the map doesn't grow without bound. */
function pruneRecentlyAttempted(now: number) {
  for (const [hash, ts] of recentlyAttempted) {
    if (now - ts > COOLDOWN_MS) recentlyAttempted.delete(hash);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────

async function tick() {
  try {
    // 0. Prune stale cooldown entries
    pruneRecentlyAttempted(Date.now());

    // 1. Check bot balance
    const balance = await publicClient.getBalance({ address: account.address });
    log.debug("Bot balance", { eth: formatEther(balance) });

    if (balance < MIN_PROFIT_WEI) {
      log.warn("Bot balance very low", { eth: formatEther(balance) });
    }

    // 2. Check gobbler pot
    const gobblePayout = await getGobblePayout(publicClient);
    log.info("Gobbler pot", { warpgobb: formatEther(gobblePayout) });

    if (gobblePayout === 0n) {
      log.info("Gobbler pot is empty — skipping cycle");
      return;
    }

    // 3. Fetch listings
    const listings = await fetchListings();
    log.info(`Fetched ${listings.length} listings`);

    if (listings.length === 0) return;

    // 4. Filter out recently attempted
    const now = Date.now();
    const fresh = listings.filter((l) => {
      const lastAttempt = recentlyAttempted.get(l.orderHash);
      return !lastAttempt || now - lastAttempt > COOLDOWN_MS;
    });

    if (fresh.length === 0) {
      log.debug("All listings recently attempted — waiting");
      return;
    }

    // 5. Sort by price ascending (cheapest first = best arb opportunity)
    fresh.sort((a, b) => (a.priceWei < b.priceWei ? -1 : a.priceWei > b.priceWei ? 1 : 0));

    // 6. Evaluate opportunities
    for (const listing of fresh) {
      const opp = await evaluateOpportunity(publicClient, listing);

      if (!opp.profitable) {
        log.debug("Not profitable", {
          tokenId: listing.tokenId,
          netProfit: formatEther(opp.netProfit),
        });
        continue;
      }

      // 7. Found a profitable opportunity!
      log.info("PROFITABLE OPPORTUNITY FOUND", {
        tokenId: listing.tokenId,
        listingPrice: formatEther(listing.priceWei),
        gobblePayout: formatEther(opp.gobblePayout),
        swapOutput: formatEther(opp.estimatedSwapOutput),
        netProfit: formatEther(opp.netProfit),
      });

      // 8. Execute (or simulate in dry run)
      recentlyAttempted.set(listing.orderHash, now);
      const result = await executeSnipe(publicClient, walletClient, opp);

      if (result.success) {
        if (result.simulated) {
          log.info("Dry run simulation passed", { tokenId: listing.tokenId });
        } else {
          log.info("SNIPE EXECUTED SUCCESSFULLY", {
            tokenId: listing.tokenId,
            txHash: result.txHash,
          });
        }
        // After a successful gobble, the pot is drained — skip remaining listings this cycle
        break;
      } else {
        log.warn("Snipe failed", {
          tokenId: listing.tokenId,
          error: result.error,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Tick error", { error: msg });
  }
}

// ─── Startup ──────────────────────────────────────────────────────────

async function main() {
  log.info("═══════════════════════════════════════════════════");
  log.info("  WarpletGobbler Arb Bot");
  log.info("═══════════════════════════════════════════════════");
  log.info("Config", {
    bot: account.address,
    sniper: GOBBLE_SNIPER_ADDRESS,
    gobbler: DUTCH_AUCTION_ADDRESS,
    warpgobb: WARPGOBB_TOKEN_ADDRESS,
    weth: WETH_ADDRESS,
    minProfit: formatEther(MIN_PROFIT_WEI),
    maxSpend: formatEther(MAX_SPEND_WEI),
    pollInterval: `${POLL_INTERVAL_MS / 1000}s`,
    dryRun: DRY_RUN,
  });
  log.info("═══════════════════════════════════════════════════");

  // Initial balance check
  const balance = await publicClient.getBalance({ address: account.address });
  log.info("Bot ETH balance", { eth: formatEther(balance) });

  // A slow tick (RPC/OpenSea stall) must not overlap the next interval —
  // two concurrent ticks can both pass the `recentlyAttempted` check and
  // double-submit the same snipe.
  let tickInFlight = false;
  const guardedTick = async () => {
    if (tickInFlight) {
      log.debug("Skipping tick — previous tick still running");
      return;
    }
    tickInFlight = true;
    try {
      await tick();
    } finally {
      tickInFlight = false;
    }
  };

  // Run first tick immediately
  await guardedTick();

  // Then poll
  const interval = setInterval(guardedTick, POLL_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down...");
    clearInterval(interval);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
