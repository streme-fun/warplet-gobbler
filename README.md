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
├── contracts/          # Foundry — Solidity contracts
│   ├── src/            # Contract source + interfaces
│   ├── test/           # Forge tests
│   └── script/         # Deploy scripts
├── web/                # Next.js — Frontend app
│   ├── src/app/        # App router pages
│   ├── src/abi/        # Contract ABIs (copied from contracts/out/)
│   ├── src/hooks/      # React hooks (wagmi)
│   └── src/lib/        # Shared utils, contract addresses
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
cp web/.env.example web/.env.local
cp contracts/.env.example contracts/.env

# Run the web app
pnpm dev

# Build contracts
cd contracts && forge build

# Run contract tests
cd contracts && forge test
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
- [ ] Streme Staking config (supply? lock? duration?)
- [ ] Should $STRAT be used to _extend_ Staking rewards or _boost_ them? ( add to the pile or 2nd stream to the pool, respectively)
