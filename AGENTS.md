# AGENTS.md

## Project Overview

WarpletGobbler is a PunkStrategy-style flywheel for [Warplets](https://opensea.io/collection/the-warplets-farcaster) NFTs on Base, using Superfluid streaming. Three-part system:

1. **FeeHandler** — Collects WETH LP fees, swaps to the streaming SuperToken ($WARPGOBB, launched via Streme), opens the Superfluid stream into the Gobbler
2. **DutchAuction ("The Gobbler")** — $WARPGOBB streams in via Superfluid; deposit a Warplet NFT to drain the pot
3. **AuctionSell** — Gobbled Warplets auctioned for the bid token (`NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL`); adapted from DegenDogs
4. **StratStaking** — Reuses existing streme.fun staking contract; auction proceeds flow to stakers

## Monorepo Structure

pnpm workspace with two packages:

- `web/` — Next.js 14 (App Router) frontend with wagmi/viem/ConnectKit for Base chain
- `contracts/` — Foundry (Solidity 0.8.26) smart contracts (git submodule deps: forge-std, openzeppelin-contracts)

Note: `contracts/` is NOT in the pnpm workspace — it's a standalone Foundry project.

## Important

Do NOT run build, dev, lint, typecheck, or any other build/compile commands unless explicitly asked to.

## Commands

```bash
# Root — delegates to web/
pnpm install          # install all workspace deps
pnpm dev              # run Next.js dev server (web/)
pnpm build            # build Next.js (web/)

# Web
cd web
pnpm lint             # next lint
pnpm typecheck        # tsc --noEmit

# Contracts (Foundry — not managed by pnpm)
cd contracts
forge build           # compile contracts
forge test            # run tests
forge fmt             # format Solidity
```

## Architecture Notes

### Web (`web/`)

- **App Router** — thin server route pages (`src/app/page.tsx`, `src/app/buy/page.tsx`, `src/app/sell/page.tsx`) each render the shared client shell `src/components/HomeView.tsx` and set their own `fc:miniapp` embed; `/buy` and `/sell` pass an `initialView` so the app opens to the matching screen. `HomeView.tsx` is the page shell (intentionally larger than the small split components below). Other UI components split into `src/components/`
- **Components** (`src/components/`) — one file per component:
  - `AbyssBackground.tsx` — ground silhouette SVG + floating void particles
  - `ParallaxBackground.tsx` — depth-layered warplet field (back/mid/front layers)
  - `Particles.tsx` — color particle effects around the gobbler
  - `GobbleOverlay.tsx` — full-screen jaw chomp animation (canvas)
  - `GobblePeek.tsx` — ambient jaw peek every ~45s (canvas)
  - `StreamingNumber.tsx` — real-time ticking number (rAF, no re-renders)
  - `CountdownTimer.tsx` — HH:MM:SS countdown display
  - `StatBar.tsx` — labeled progress bar
  - `AuctionWarpletCanvas.tsx` — canvas blob/tendrils + strike animation for auction items
  - `AuctionItem.tsx` — auction card (uses AuctionWarpletCanvas + StreamingNumber)
  - `FlyingWarplet.tsx` — fly-to-center transition animation
- **Mock data** (`src/lib/mock-data.ts`) — all mock constants (prices, auctions, user warplets)
- **Providers** (`src/app/providers.tsx`) — wagmi + ConnectKit + React Query, configured for Base chain only
- **Contract addresses** (`src/lib/contracts.ts`) — read from `NEXT_PUBLIC_*` env vars, fall back to `ZERO_ADDRESS` if unset
- **ABIs** go in `src/abi/` (copied from `contracts/out/`)
- **Hooks** go in `src/hooks/` (wagmi hooks for contract interactions)
- **Styling** — Tailwind CSS 3 + daisyUI with a custom `warplet` dark theme. All custom animations (breathing glow, parallax, abyss tendrils, void particles) are in `globals.css`
- **Font** — EB Garamond (Google Fonts via `next/font`)
- **Path alias** — `@/*` maps to `./src/*`
- **Webpack config** (`next.config.js`) — polyfill exclusions for web3 libs (fs, net, tls, pino-pretty, lokijs, encoding)

### Contracts (`contracts/`)

- Solidity 0.8.26 with optimizer (200 runs)
- `FeeHandler.sol` — functional, claims WETH LP fees, swaps to $WARPGOBB via StremeZapUniversal, streams to Gobbler via Superfluid CFA
- `DutchAuction.sol` — functional, receives Superfluid stream, allows Warplet deposit to drain pot
- `AuctionSell.sol` — functional, FIFO queue + bid token auction for gobbled Warplets, proceeds route to staking
- `GobbledWarplets.sol` — functional, receipt NFT minted when a Warplet is gobbled
- `GobbleSniper.sol` — functional, arbitrage helper for gobble-then-relist
- `StratStaking.sol` — placeholder, reuses existing streme.fun contract
- Interfaces in `src/interfaces/`
- Unit tests in `test/`, fork tests in `test/fork/` (Base mainnet via `BASE_RPC_URL` in `.env`)
- Deploy scripts in `script/` for all functional contracts

### Design System

The daisyUI theme `warplet` uses these semantic colors:

- **primary**: `#00F5FF` (cyan) — Gobbler/main actions
- **secondary**: `#7B61FF` (purple) — Auction
- **accent**: `#FF007A` (pink) — Staking
- **base-100/200/300**: dark purples (`#13111C` → `#221F2E`)

Dynamic daisyUI classes like `bg-primary/20` are safelisted in `tailwind.config.js`.

### Environment Variables

- `web/.env.local`: `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect), `NEXT_PUBLIC_BASE_RPC_URL` (optional), `NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL` / `NEXT_PUBLIC_AUCTION_BID_TOKEN_SYMBOL` (UI labels), `NEXT_PUBLIC_APP_URL` (deployed base URL for Farcaster mini-app embed launch URLs; defaults to `https://warpletgobbler.xyz` — set it on preview/staging or share links embed production)
- `web/.env.local` (gobbled image pipeline): `GEMINI_API_KEY`, `warpletgobbler_READ_WRITE_TOKEN` (Vercel Blob), `PINATA_JWT`, `PINATA_GATEWAY_URL`
- `contracts/.env`: `BASE_RPC_URL`, `BASESCAN_API_KEY`, `DEPLOYER_PRIVATE_KEY`
