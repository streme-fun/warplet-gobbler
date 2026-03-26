# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WarpletGobbler is a PunkStrategy-style flywheel for [Warplets](https://opensea.io/collection/the-warplets-farcaster) NFTs on Base, using Superfluid streaming. Three-part system:
1. **DutchAuction ("The Gobbler")** — USDCx streams in via Superfluid; deposit a Warplet NFT to drain the pot
2. **AuctionSell** — Gobbled Warplets auctioned for $STRAT tokens (stub, adapted from DegenDogs)
3. **StratStaking** — Reuses existing streme.fun staking contract

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
- **App Router** — page shell at `src/app/page.tsx`, all UI components split into `src/components/`
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
- **Contract addresses** (`src/lib/contracts.ts`) — placeholder zeros, update after deployment
- **ABIs** go in `src/abi/` (copied from `contracts/out/`)
- **Hooks** go in `src/hooks/` (wagmi hooks for contract interactions)
- **Styling** — Tailwind CSS 3 + daisyUI with a custom `warplet` dark theme. All custom animations (breathing glow, parallax, abyss tendrils, void particles) are in `globals.css`
- **Font** — EB Garamond (Google Fonts via `next/font`)
- **Path alias** — `@/*` maps to `./src/*`
- **Webpack config** (`next.config.js`) — polyfill exclusions for web3 libs (fs, net, tls, pino-pretty, lokijs, encoding)

### Contracts (`contracts/`)
- Solidity 0.8.26 with optimizer (200 runs)
- `DutchAuction.sol` — functional, receives Superfluid USDCx stream, allows Warplet deposit to drain pot
- `AuctionSell.sol` — stub (all functions revert "not implemented")
- `StratStaking.sol` — placeholder, reuses existing streme.fun contract
- Interfaces in `src/interfaces/`
- Fork testing configured against Base mainnet (`BASE_RPC_URL` in `.env`)
- No tests or deploy scripts exist yet

### Design System
The daisyUI theme `warplet` uses these semantic colors:
- **primary**: `#00F5FF` (cyan) — Gobbler/main actions
- **secondary**: `#7B61FF` (purple) — Auction
- **accent**: `#FF007A` (pink) — Staking
- **base-100/200/300**: dark purples (`#13111C` → `#221F2E`)

Dynamic daisyUI classes like `bg-primary/20` are safelisted in `tailwind.config.js`.

### Environment Variables
- `web/.env.local`: `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect), `NEXT_PUBLIC_BASE_RPC_URL` (optional)
- `contracts/.env`: `BASE_RPC_URL`, `BASESCAN_API_KEY`, `DEPLOYER_PRIVATE_KEY`
