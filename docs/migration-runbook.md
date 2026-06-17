# WarpletGobbler migration runbook

**Strategy:** deploy the new stack now and unlock gobbling (sell path) immediately, but keep the **new** auction house paused and the **public bidding UI** on the legacy contract until lot `#987458` finishes. Cut over in one coordinated moment when that auction ends; then ops drains the legacy queue via bots.

**Live references (Base mainnet, deploy block 47430889, 2026-06-16):**

| | Address |
|---|---------|
| **New `GobbledWarplets`** | `0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2` |
| **New `AuctionSell`** (paused) | `0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D` |
| **New `DutchAuctionV2` (Gobbler)** | `0x3D44b22900A103ACF29dC8e81CDCB6306658F234` |
| Legacy `AuctionSell` | `0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9` |
| Legacy `GobbledWarplets` | `0x2159d7AAfA7CC6cBFf49B1ab9BD353c7e0d1d10b` |
| Legacy `DutchAuctionV2` | `0x6B2A584369B2E81269618921C3b0033581819e39` |
| `FeeHandler` (keep) | `0x31aaf0B92Bac3ce9336FA1494A1405c24Cb449E4` |
| `$WARPGOBB` (keep) | `0x1A339C38Ae22726F1A4235bCecf8f12aebE4C5E8` |
| Live legacy auction lot | Warplet `#987458` |
| New queue (paused) | `#497116` (1 waiting) |
| Legacy queue | `#420499`, `#421769`, `#266221`, `#249800` |

**GitHub tracker:** [streme-fun project #2](https://github.com/orgs/streme-fun/projects/2/views/1) — issues [#64–#71](https://github.com/streme-fun/warplet-gobbler/issues?q=label%3Amigration). Status: **Phase B complete (2026-06-17)** — Phase C legacy queue drain next.

### Target dates (strict)

| Issue | Task | Target date |
|-------|------|-------------|
| [#64](https://github.com/streme-fun/warplet-gobbler/issues/64) | Master tracker / Phase A closeout | **2026-06-17** |
| [#65](https://github.com/streme-fun/warplet-gobbler/issues/65) | B1: settle legacy `#987458` | **2026-06-17** (after ~16:05 UTC) |
| [#66](https://github.com/streme-fun/warplet-gobbler/issues/66) | B2: `adminMint` winner receipt | **2026-06-17** |
| [#67](https://github.com/streme-fun/warplet-gobbler/issues/67) | B3: unpause new auction | **2026-06-17** |
| [#68](https://github.com/streme-fun/warplet-gobbler/issues/68) | B4: frontend full cutover | **2026-06-17** |
| [#69](https://github.com/streme-fun/warplet-gobbler/issues/69) | B5: legacy `setProceedsRecipient` | **2026-06-17** |
| [#70](https://github.com/streme-fun/warplet-gobbler/issues/70) | C: bot drain legacy queue | **2026-06-21** |
| [#71](https://github.com/streme-fun/warplet-gobbler/issues/71) | D: rotate admin to multisig | **2026-06-24** |

---

## Does this plan sound right?

**Yes**, with one explicit split:

| Phase | On-chain | Frontend |
|-------|----------|----------|
| **A — Now** | Deploy new stack; **do not** `unpause` new `AuctionSell`; `FeeHandler` repoints stream to new Gobbler | Point **Gobbler only** at new `DutchAuctionV2` so “Sell Warplet” works; keep **auction/bidding** env on legacy until Phase B |
| **B — When `#987458` ends** | Settle legacy lot; `unpause` new auction; `adminMint` receipt; repoint `proceedsRecipient` on legacy to ops | Full cutover to new auction + gobbled addresses; **remove** legacy env vars; redeploy |

“Sell Warplet” in the app = `gobble()` on the Gobbler → Warplet lands in `nftReserve` (`AuctionSell` queue). That path is broken today because the stream and/or UI still target the old Gobbler. After Phase A, new gobbles enqueue on the **new** `AuctionSell` even while it is **paused** (NFT deposits are not gated by pause; only bidding / `startAuction` are).

---

## Phase A — Deploy now (before `#987458` ends)

### A1. Pre-flight

- [x] `contracts/.env` filled (`forge build` clean)
- [x] `GOBBLED_WARPLETS_TOKEN_URI_SETTER` matches Vercel `GOBBLED_TOKEN_URI_SETTER_PRIVATE_KEY`
- [ ] Ops wallet funded ($WARPGOBB for legacy drain later; gas on Base)
- [ ] Record legacy deploy block for later (`NEXT_PUBLIC_AUCTION_SELL_LEGACY_DEPLOY_BLOCK`)
- [ ] Update `contracts/.env` with new deployed addresses

### A2. Deploy new stack (single script)

```bash
cd contracts
forge script script/DeployWarpletGobblerStack.s.sol:DeployWarpletGobblerStack \
  --rpc-url base --broadcast --verify -vvv
```

**Record:** deploy block `47430889`.

| Contract | Address |
|----------|---------|
| `NEW_GOBBLED_WARPLETS` | `0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2` |
| `NEW_AUCTION_SELL` | `0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D` |
| `NEW_GOBBLER` | `0x3D44b22900A103ACF29dC8e81CDCB6306658F234` |

This atomically:

1. Deploys `GobbledWarplets` + `AuctionSell` (**paused**)
2. Wires `gobbled.setMinter(auctionSell)`
3. Deploys `DutchAuctionV2` with `nftReserve = NEW_AUCTION_SELL`
4. Calls `FeeHandler.setAuction(NEW_GOBBLER)` + `startStream()` — **stream now funds the new Gobbler**

**Do not run `AuctionSellUnpause` yet.**

Optional: `DEPLOY_GOBBLE_SNIPER=1` in env if you want sniper in the same broadcast.

### A3. Partial frontend deploy (unlock sell only)

Update Vercel / `web/.env.local`:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_DUTCH_AUCTION_ADDRESS` | `0x3D44b22900A103ACF29dC8e81CDCB6306658F234` |
| `NEXT_PUBLIC_AUCTION_SELL_ADDRESS` | **legacy** `0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9` (unchanged until Phase B) |
| `NEXT_PUBLIC_GOBBLED_WARPLETS_ADDRESS` | `0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2` (optional until Phase B) |
| `NEXT_PUBLIC_AUCTION_SELL_LEGACY_ADDRESS` | legacy `0xa104…` |
| `NEXT_PUBLIC_GOBBLED_WARPLETS_LEGACY_ADDRESS` | legacy `0x2159…` |
| `NEXT_PUBLIC_AUCTION_SELL_LEGACY_DEPLOY_BLOCK` | legacy deploy block |

Redeploy web. Verify:

- [x] “Sell Warplet” gobble succeeds → Warplet appears in **new** `AuctionSell` queue (`queuedLength` on new contract) — `#497116` enqueued
- [x] Live auction UI still shows `#987458` on **legacy** `AuctionSell`
- [x] Bidding on legacy still works (until you intentionally stop it)
- [x] New auction: `paused() == true`, no live lot, no bids accepted

### A4. Wait

- Let `#987458` run to `endTime` on legacy.
- New gobbles during this window accumulate in the **new** paused queue (good).
- Do **not** outbid current high bidder on `#987458` (`0x7732f594c38D4940E1076AA9F6f53065B7915953`).

---

## Phase B — Cutover (when `#987458` ends)

Execute in order the same day. Goal: one clean handoff.

**2026-06-17 execution log:**

| Step | Status | Tx / result |
|------|--------|-------------|
| B1 `#987458` settle | done (prior) | Legacy live lot is now `#420499` |
| B2 `adminMint` winner | done | [0x221a…880b](https://basescan.org/tx/0x221a6fc06cafa8a7928dd7dcf8a09ca02d4fba565b4ae2839651b473a061880b) |
| B3 `unpause` new auction | done | Live lot `#497116` |
| B4 Vercel cutover | done | Live lot `#497116` on new `AuctionSell` |
| B5 `setProceedsRecipient` | done | [0x91fb…ebde1](https://basescan.org/tx/0x91fbdf0396a8ae37bfa39175b4678bdc634731e5d419ac77405927f7862ebde1) → `0x91af…4380` |

### B1. Settle legacy lot (permissionless)

Anyone (or ops):

```bash
cast send 0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9 \
  "settleCurrentAndCreateNewAuction()" \
  --rpc-url base --private-key $PRIVATE_KEY
```

Effect:

- `#987458` settles; winner’s reservation is recorded on **legacy** `GobbledWarplets`
- Legacy contract auto-starts next queued lot (`#249800`) — **ignore for public UI**; bots will handle legacy from here

Winner pulls underlying Warplet from legacy auction (if not already):

```bash
# Winner EOA — on legacy GobbledWarplets
cast send 0x2159d7AAfA7CC6cBFf49B1ab9BD353c7e0d1d10b \
  "rescueWarplet(uint256)" 987458 \
  --rpc-url base --private-key $WINNER_PK
```

(Or winner uses legacy UI if still wired — Phase B frontend may remove this.)

### B2. Mint gobbled receipt for legacy winner (ops)

On **new** `GobbledWarplets`, as owner:

```bash
cast send 0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2 \
  "adminMint(address,uint256,string)" \
  0x7732f594c38D4940E1076AA9F6f53065B7915953 \
  987458 \
  "ipfs://<metadata-uri>" \
  --rpc-url base --private-key $PRIVATE_KEY
```

Prepare metadata URI beforehand (Pinata / `/api/mint-gobbled-nft` pipeline). `#987458` is **not** re-enqueued on the new auction.

### B3. Unpause new auction + open first sale if queue non-empty

```bash
AUCTION_SELL_ADDRESS=0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D \
forge script script/AuctionSellUnpause.s.sol:AuctionSellUnpause \
  --rpc-url base --broadcast -vvv
```

If the new queue already has gobbled Warplets and `unpause` did not auto-start a lot:

```bash
cast send 0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D \
  "startAuction(uint256)" <headTokenId> \
  --rpc-url base --private-key $PRIVATE_KEY
```

Or use the site “Start auction” button once UI points at the new contract.

### B4. Full frontend cutover

Update Vercel:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_AUCTION_SELL_ADDRESS` | `0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D` |
| `NEXT_PUBLIC_GOBBLED_WARPLETS_ADDRESS` | `0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2` |
| `NEXT_PUBLIC_AUCTION_SELL_DEPLOY_BLOCK` | `47430889` |
| `NEXT_PUBLIC_DUTCH_AUCTION_ADDRESS` | `0x3D44b22900A103ACF29dC8e81CDCB6306658F234` (already hardcoded in code) |

**Remove** (legacy overlay no longer needed):

- `NEXT_PUBLIC_AUCTION_SELL_LEGACY_ADDRESS`
- `NEXT_PUBLIC_GOBBLED_WARPLETS_LEGACY_ADDRESS`
- `NEXT_PUBLIC_AUCTION_SELL_LEGACY_DEPLOY_BLOCK`

Redeploy web. Verify live lot + bidding read **new** `AuctionSell`, ETH bids work (`stremeZap` set).

### B5. Point legacy auction proceeds to ops (bot drain)

On **legacy** `AuctionSell`, as owner:

```bash
cast send 0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9 \
  "setProceedsRecipient(address)" $OPS_WALLET \
  --rpc-url base --private-key $PRIVATE_KEY
```

Future legacy wins by bots return $WARPGOBB to ops instead of staking.

Optional: `pause()` legacy auction when you no longer want public interaction:

```bash
cast send 0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9 "pause()" ...
```

---

## Phase C — Legacy queue drain (bots / ops, ~4 days)

For each legacy queued Warplet (`#249800`, `#421769`, `#266221`, `#420499`):

1. Let legacy auction cycle complete (or bot bids on legacy `#249800` etc.)
2. `settleCurrentAndCreateNewAuction()` on legacy (or `settle()` if paused)
3. `rescueWarplet(warpletId)` on **legacy** `GobbledWarplets` (ops/bot wallet)
4. `warplets.safeTransferFrom(ops, NEW_AUCTION_SELL, tokenId)` → tail of **new** queue
5. Optionally `startAuction` on **new** contract as tail items accumulate

No frontend legacy overlay after Phase B — track via bot/indexer only.

When legacy `queuedLength() == 0` and no live legacy auction:

```bash
cast send 0xa1046076E518B3Fe1604B2F19ABE90c55c252fd9 "pause()" ...
```

---

## Phase D — Admin hygiene (when stable)

```bash
# Rotate new stack admin to multisig
MULTISIG_ADDRESS=... \
FEE_HANDLER_ADDRESS=0x31aaf0B92Bac3ce9336FA1494A1405c24Cb449E4 \
AUCTION_SELL_ADDRESS=0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D \
GOBBLED_WARPLETS_ADDRESS=0x6ba8972b58f6148D6f110D9e33fDd3DD581c96f2 \
forge script script/RotateAdminToMultisig.s.sol:RotateAdminToMultisig \
  --rpc-url base --broadcast -vvv
```

Update `arb/.env` `GOBBLE_SNIPER_ADDRESS` if redeployed.

---

## Quick reference — what runs when

| Moment | Transaction | Contract |
|--------|-------------|----------|
| **Now** | `DeployWarpletGobblerStack` | new stack + FeeHandler repoint |
| **Now** | *(none)* | **Do not** unpause new auction |
| **Now** | Vercel: new Gobbler address only | unlock Sell |
| **`#987458` ends** | `settleCurrentAndCreateNewAuction()` | legacy auction |
| **Cutover** | `adminMint(winner, 987458, uri)` | new GobbledWarplets |
| **Cutover** | `unpause()` | new auction |
| **Cutover** | `startAuction(head)` if needed | new auction |
| **Cutover** | Vercel: new auction + gobbled; drop legacy vars | full UI |
| **Cutover** | `setProceedsRecipient(ops)` | legacy auction |
| **After** | bot bid / settle / rescue / `safeTransfer` | legacy → new tail |

---

## FAQ

**Is `startAuction` the tx when `#987458` finishes?**  
No. When `#987458` finishes you call **`settleCurrentAndCreateNewAuction` on the legacy contract**. That settles the lot and automatically opens the next **legacy** auction. On the **new** contract, `startAuction` is only for opening bidding on the **new** queue head after you `unpause` at cutover.

**Why deploy FeeHandler repoint before cutover?**  
So the $WARPGOBB stream fills the **new** Gobbler and “Sell Warplet” pays out correctly, while bidding stays on legacy until Phase B.

**Why keep new auction paused?**  
So no public bids hit the new house until you intentionally switch the UI and unpause together.
