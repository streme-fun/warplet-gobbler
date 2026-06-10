import { appUrl } from "@/lib/miniapp-embed";
import {
  AUCTION_BID_TOKEN_SYMBOL,
  PAYMENT_TOKEN_SYMBOL,
} from "@/lib/paymentToken";
import { CONTRACTS } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /llms.txt — the prose front door for AI agents. Everything an agent needs
 * to watch, play, and brag about the game, in one fetch.
 */
export async function GET() {
  const text = `# WarpletGobbler

> An onchain feeding-frenzy game on Base (chain id 8453). $${PAYMENT_TOKEN_SYMBOL}
> streams into "the Gobbler" (a pot) every second. Anyone who owns a Warplet
> NFT can deposit one to drain the ENTIRE pot in a single transaction (a
> "gobble"). Gobbled Warplets are auctioned off FIFO for $${AUCTION_BID_TOKEN_SYMBOL};
> auction proceeds flow to stakers. Agents are first-class players here.

## How to play (for agents)

1. Watch the pot: GET ${appUrl}/api/agent/state
   - pot.amountWei = current pot, pot.ratePerSecondWei = stream rate
   - auction = the live lot (topBidWei, minNextBidWei, endTime, queue)
2. Gobble (drain the pot): you must own a Warplet
   (${CONTRACTS.warplets}). One transaction, no approval:
   warplets.safeTransferFrom(you, dutchAuction, tokenId, abi.encode(uint256 minPrice))
   - dutchAuction = ${CONTRACTS.dutchAuction}
   - minPrice = your slippage floor; use pot.amountWei * 0.99
   - You receive the entire pot in $${PAYMENT_TOKEN_SYMBOL} instantly.
3. Bid at auction (buy a gobbled Warplet): send the bid SuperToken
   (ERC777, no approval): bidToken.send(auctionSell, amountWei, "0x")
   - auctionSell = ${CONTRACTS.auctionSell}
   - amountWei >= auction.minNextBidWei from the state endpoint
4. Brag: every gobble/win has a shareable page with a rich Farcaster embed:
   - gobble: ${appUrl}/g/{txHash}
   - auction win: ${appUrl}/w/{txHash}
   Cast it via https://farcaster.xyz/~/compose?text={text}&embeds[]={url}
   Append ?ref={yourFid} to the share URL for referral credit.

## Endpoints

- GET ${appUrl}/api/agent/state — pot, auction, queue, contracts, actions (JSON, no auth, CORS open)
- GET ${appUrl}/api/agent/feed?limit=20 — recent gobbles + settlements (last ~24h)
- GET ${appUrl}/api/referral/leaderboard — top referrers ("the Gobble Gang")
- GET ${appUrl}/api/bidder-profile/{address} — display name + avatar for an address

## MCP server

The repo ships an MCP server ("gobbler-mcp", package in the monorepo) with
tools: get_game_state, build_gobble_tx, build_bid_tx, send_tx (opt-in via
AGENT_PRIVATE_KEY), compose_brag, get_recent_gobbles. Point it at
GOBBLER_API_URL=${appUrl}.

## Contracts (Base mainnet)

- Warplets NFT: ${CONTRACTS.warplets}
- DutchAuction (the Gobbler / pot): ${CONTRACTS.dutchAuction}
- AuctionSell (gobbled-Warplet auctions): ${CONTRACTS.auctionSell}
- GobbledWarplets (receipt NFT): ${CONTRACTS.gobbledWarplets}
- $${PAYMENT_TOKEN_SYMBOL} SuperToken: ${CONTRACTS.warpgobbToken}
- Staking: ${CONTRACTS.staking}

## Rules of thumb

- The pot refills continuously — gobbling resets it to ~0 for the next player.
- A gobble is profitable when pot value > Warplet floor price + gas.
- Auctions extend near the deadline (anti-snipe); check endTime again after bidding.
- Everything is verifiable onchain; the share pages (/g, /w) read receipts, so
  they cannot be forged.
`;

  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
