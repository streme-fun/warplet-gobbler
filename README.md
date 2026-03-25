# WarpletGobbler

A PunkStrategy-style flywheel for [Warplets](https://opensea.io/collection/the-warplets-farcaster) using Superfluid streaming.

## How It Works

```
Fee treasury ──stream USDCx──▸ Dutch Auction ("Gobbler")
                                      │
                     Arbitrageur deposits Warplet, drains pot
                                      │
                                      ▼
                               Auction Sell
                      (highest $STRAT bid wins Warplet)
                                      │
                          $STRAT proceeds ──▸ Staking
```

1. **The Gobbler** — A dutch auction that receives a continuous USDCx stream. The pot grows over time. Anyone can deposit a Warplet NFT and drain the full balance. Arbitrageurs buy Warplets on OpenSea when the pot exceeds floor price, deposit them, and profit the difference.

2. **Auction Sell** — Gobbled Warplets are auctioned to highest bidder, denominated in $STRAT tokens.

3. **Staking** — $STRAT from auctions flows to stakers, closing the flywheel.

## Monorepo Structure

```
warplet-gobbler/
├── packages/
│   ├── contracts/     # Foundry — Solidity contracts
│   │   ├── src/       # Contract source + interfaces
│   │   ├── test/      # Forge tests
│   │   └── script/    # Deploy scripts
│   └── web/           # Next.js — Frontend app
│       ├── src/app/   # App router pages
│       ├── src/abi/   # Contract ABIs (copied from contracts/out/)
│       ├── src/hooks/ # React hooks (wagmi)
│       └── src/lib/   # Shared utils, contract addresses
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 9+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Setup

```bash
# Install dependencies
pnpm install

# Copy env files
cp packages/web/.env.example packages/web/.env.local
cp packages/contracts/.env.example packages/contracts/.env

# Run the web app
pnpm dev

# Build contracts
pnpm build:contracts

# Run contract tests
pnpm test
```

## Team

- **Lee** — Frontend & app
- **Fran / Pierre** — Smart contracts (DutchAuction, Superfluid integration)
- **Mark** — AuctionSell (adapted from DegenDogs)

## Open Questions

- [ ] Auction duration for sell side (24h? configurable?)
- [ ] What happens if auction gets no bids?
- [ ] Superfluid CFA vs GDA for treasury stream
- [ ] Hook whitelisting timeline (launching without hook initially)
- [ ] $STRAT initial supply and distribution
