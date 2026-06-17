import { sdk } from "@farcaster/miniapp-sdk";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";

/** Base mainnet chain id — Streme + $WARPGOBB live here. */
const BASE_CHAIN_ID = 8453;

/** streme.fun base URL (token discovery / swap / stake). */
const STREME_BASE_URL = "https://streme.fun";

const warpgobbAddress = CONTRACTS.warpgobbToken;

/** Whether the $WARPGOBB token address is configured (`NEXT_PUBLIC_WARPGOBB_TOKEN_ADDRESS`). */
export const IS_WARPGOBB_CONFIGURED = warpgobbAddress !== ZERO_ADDRESS;

/** streme.fun token page for $WARPGOBB, or the homepage when the address is unset. */
export const WARPGOBB_STREME_URL = IS_WARPGOBB_CONFIGURED
  ? `${STREME_BASE_URL}/token/${warpgobbAddress}`
  : STREME_BASE_URL;

/** CAIP-19 asset ids for the Farcaster mini-app swap action. */
const WARPGOBB_CAIP19 = `eip155:${BASE_CHAIN_ID}/erc20:${warpgobbAddress}`;
const BASE_ETH_CAIP19 = `eip155:${BASE_CHAIN_ID}/native`;

/**
 * Buy $WARPGOBB from wherever the user is:
 * - Inside a Farcaster mini-app → open the host's native token swap (ETH → $WARPGOBB).
 * - On the web (desktop browser) → open the streme.fun token page in a new tab.
 *
 * Safe to call from a click handler; never throws.
 */
export async function buyWarpgobb(): Promise<void> {
  let inMiniApp = false;
  try {
    inMiniApp = await sdk.isInMiniApp();
  } catch {
    inMiniApp = false;
  }

  if (inMiniApp) {
    try {
      if (IS_WARPGOBB_CONFIGURED) {
        await sdk.actions.swapToken({
          buyToken: WARPGOBB_CAIP19,
          sellToken: BASE_ETH_CAIP19,
        });
      } else {
        await sdk.actions.openUrl(STREME_BASE_URL);
      }
    } catch (err) {
      console.error("buyWarpgobb: mini-app action failed", err);
    }
    return;
  }

  if (typeof window !== "undefined") {
    window.open(WARPGOBB_STREME_URL, "_blank", "noopener,noreferrer");
  }
}
