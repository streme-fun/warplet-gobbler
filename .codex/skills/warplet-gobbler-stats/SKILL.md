---
name: warplet-gobbler-stats
description: Fetch current WarpletGobbler stats for casts, images, and daily updates. Use when the user asks for today's/current/live WarpletGobbler numbers, auction stats, Warplets held, top bid USD, Warplets floor, WARPGOBB market cap, or the data needed for a stats cast/image.
---

# WarpletGobbler Stats

Use this skill to refresh WarpletGobbler numbers from live sources instead of copying stale values from prior casts.

## Quick Start

From the repo root, run:

```bash
node .codex/skills/warplet-gobbler-stats/scripts/fetch-stats.cjs
```

The script reads `web/.env.local`, queries:

- Base RPC for the live auction, Warplets held, queue length, and 24h Warplet transfers into auction custody.
- OpenSea for The Warplets floor.
- Dexscreener for `$WARPGOBB` price and market cap.

Network access is required. If sandboxed network access fails, rerun with escalation.

## Output Contract

Use `imageCopy` for stats-image prompts. Use `stats` for reasoning or custom copy.

Important fields:

- `stats.holdings`: current Warplet NFT balance held by the auction contract.
- `stats.heldDelta24h`: ERC-721 transfers into auction custody over roughly the last 24h. Prefer this for `(+N today)`.
- `stats.topBidWarpgobb`, `stats.topBidUsd`: current high bid.
- `stats.warpletsFloorEth`, `stats.warpletsFloorUsd`: current collection floor.
- `stats.warpgobbMarketCapUsd`: market cap from the selected Dexscreener pair.
- `stats.floorMultiple`: `topBidUsd / warpletsFloorUsd`; use for the hero metric.

Do not treat OpenSea 24h sales as Gobbler purchases. Use `heldDelta24h` for Warplets the Gobbler actually bought/received.

## Formatting Rules

- Hero metric: `~{rounded floorMultiple}x floor`.
- Holdings: `{holdings} Warplets held (+{heldDelta24h} today)` when `heldDelta24h > 0`; otherwise omit the parenthetical.
- Floor: `Warplets Floor: ~0.0026 ETH`.
- Market cap: `$WARPGOBB mkt cap: ~$56.3K`.
- Top bid: `402.6M $WARPGOBB (~$227)`.

If the live market data source is unavailable, say which field is missing and avoid inventing it.
