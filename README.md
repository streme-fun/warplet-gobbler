# WarpletGobbler

A PunkStrategy-style flywheel for [Warplets](https://opensea.io/collection/the-warplets-farcaster) using Superfluid streaming.

## How It Works

```
LP Fees (WETH) ──▸ FeeHandler ──swap──▸ $STRAT (SuperToken)
                                            │
                                     Superfluid stream
                                            │
                                            ▼
                                  Dutch Auction ("Gobbler")
                                            │
                         Arbitrageur deposits Warplet, drains pot
                                            │
                                            ▼
                                     Auction Sell
                            (highest $STRAT bid wins Warplet)
                                            │
                                $STRAT proceeds ──▸ Staking
```

1. **FeeHandler** — Collects WETH rewards from the Uniswap v4 LP locker, swaps them to $STRAT (a Superfluid SuperToken) via `StremeZapUniversal`, and opens a continuous Superfluid stream to the Gobbler. Admins control the auction target and stream duration; a permissionless `rebalanceFlowRate()` lets anyone adjust the stream rate based on current balance.

2. **The Gobbler** (`DutchAuction`) — Receives the $STRAT stream. The pot grows over time. Anyone can deposit a Warplet NFT and drain the full balance. Arbitrageurs buy Warplets on OpenSea when the pot exceeds floor price, deposit them, and profit the difference. Gobbled NFTs are sent to the `nftReserve` address.

3. **Auction Sell** — Gobbled Warplets are auctioned to the highest bidder, denominated in $STRAT tokens. *(stub — not yet implemented)*

4. **Staking** — $STRAT from auctions flows to stakers, closing the flywheel. *(reuses existing streme.fun staking contract)*

## Contracts

| Contract | Status | Description |
|---|---|---|
| `FeeHandler.sol` | **functional** | Claims LP fees (WETH), swaps to $STRAT via StremeZapUniversal, streams to auction via Superfluid CFA. Role-based access (`DEFAULT_ADMIN_ROLE`, `REBALANCER_ROLE`). |
| `DutchAuction.sol` | **functional** | Receives $STRAT stream; deposit a Warplet to drain the pot. |
| `AuctionSell.sol` | stub | All functions revert "not implemented". |
| `StratStaking.sol` | placeholder | Reuses existing streme.fun contract. |

### Test Coverage

- `test/FeeHandler.t.sol` — Unit tests with mocked Superfluid host, CFA, GDA, LP factory, and zap contracts
- `test/fork/FeeHandlerFork.t.sol` — Fork tests against Base mainnet (real SuperToken, noop LP/zap stubs)
- `test/DutchAuction.t.sol` — Unit tests for gobble mechanics and constructor

## Monorepo Structure

```
warplet-gobbler/
├── contracts/          # Foundry — Solidity contracts
│   ├── src/            # Contract source + interfaces
│   ├── test/           # Forge unit tests
│   ├── test/fork/      # Forge fork tests (Base mainnet)
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
- [x] ~~Superfluid CFA vs GDA for treasury stream~~ → CFA (FeeHandler uses `ISuperToken.flow`)
- [ ] Hook whitelisting timeline (launching without hook initially)
- [ ] $STRAT initial supply and distribution
- [ ] Streme Staking config (supply? lock? duration?)
- [ ] Should $STRAT be used to _extend_ Staking rewards or _boost_ them? ( add to the pile or 2nd stream to the pool, respectively)
- [ ] FeeHandler: test with live v4 locker + real StremeZapUniversal on fork
