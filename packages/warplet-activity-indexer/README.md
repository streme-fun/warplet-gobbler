# warplet-activity-indexer

Ponder indexer for Warplet Gobbler activity on Base.

It watches these events:
- `BidPlaced` on `AuctionSell`
- `Gobbled` on `DutchAuction`
- `AuctionSettled` on `AuctionSell`
- synthetic `NEW_USER_INTERACTION` records whenever a wallet touches the system for the first time

For each relevant event it:
1. stores a normalized record in the database
2. upserts the actor wallet into a `user` table
3. optionally enriches the wallet with Neynar / Farcaster profile data
4. sends a Telegram notification to the configured route for that event type

## Stack

- **Indexer:** Ponder
- **DB:** Postgres in production (`DATABASE_URL`), falls back to local PGlite if omitted
- **Notifications:** built into this package
- **Enrichment:** Neynar API (optional)

## Environment

Copy `.env.example` and fill in:
- `PONDER_RPC_URL_8453`
- `DATABASE_URL` (recommended for Coolify)
- `DATABASE_SCHEMA` (required by `ponder start`; e.g. `warplet_activity`)
- `PONDER_AUCTION_SELL_ADDRESS`
- `PONDER_DUTCH_AUCTION_ADDRESS`
- `PONDER_START_BLOCK`
- `TELEGRAM_DEFAULT_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID`
- optional `TELEGRAM_DEFAULT_MESSAGE_THREAD_ID`
- optional per-event overrides like:
  - `TELEGRAM_BID_PLACED_CHAT_ID`
  - `TELEGRAM_WARPLET_GOBBLED_CHAT_ID`
  - `TELEGRAM_AUCTION_SETTLED_CHAT_ID`
  - `TELEGRAM_NEW_USER_INTERACTION_CHAT_ID`
- optional `NEYNAR_API_KEY`
- optional `NEYNAR_CLIENT_ID`

## Run locally

```bash
pnpm install
cp packages/warplet-activity-indexer/.env.example packages/warplet-activity-indexer/.env
pnpm --filter warplet-activity-indexer codegen
pnpm --filter warplet-activity-indexer dev
```

This is now a single-package service: one codebase, one process, one deploy target.

## Production / Coolify

Use a single Docker-based Coolify service.

Recommended setup:
- **Dockerfile:** repo root `Dockerfile`
- **Service type:** Dockerfile / custom Docker image build
- attach a Postgres database and set `DATABASE_URL`
- set Base RPC, contract addresses, and Telegram routing env vars

The container entrypoint runs:
- `pnpm --filter warplet-activity-indexer codegen`
- `pnpm --filter warplet-activity-indexer start`

So you only need one runtime service in Coolify.

Important production notes:
- `ponder start` requires `DATABASE_SCHEMA`, even when using local PGlite.
- Ponder also requires an API app at `src/api/index.ts`; a minimal health endpoint is enough if you only need indexing + health checks.

## Telegram routing

The service supports one default route plus optional per-event overrides.

Example:
- bids → one chat/topic
- gobbles → another topic
- settlements → another room
- new-user alerts → a growth/CRM room

Routing precedence:
1. event-specific route (`TELEGRAM_BID_PLACED_*`, etc.)
2. default route (`TELEGRAM_DEFAULT_*`)
3. legacy default aliases (`TELEGRAM_*`)

## Notes

- If you set `PONDER_START_BLOCK=latest`, the service starts from “now” and avoids historical backfill.
- If you want historical indexing, set `PONDER_START_BLOCK` to the deployment block.
- `INDEXER_NOTIFY_ON_BACKFILL=false` suppresses historical notifications.
- If you still want notifications after a historical sync, set `INDEXER_NOTIFY_FROM_BLOCK` to the first block you want alerts from.
