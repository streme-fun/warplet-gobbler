# WarpletGobbler Arbitrage Service Spec

## Overview

This service monitors the following loop:

1. **Scan Opensea for 'cheap' Warplet NFTs** listed below market value (in ETH).
2. **Check the current $WARPGOBB spot price** (streme pool or via Uniswap v4/another DEX).
3. **Query the active Gobbler DutchAuction contract balance**: the amount of $WARPGOBB that will be paid out for a successful Warplet deposit.
4. **Compute potential arbitrage**:
    - Buy Warplet NFT on Opensea (`spent_eth`)
    - Deposit the Warplet to the Gobbler, receiving $WARPGOBB
    - Swap $WARPGOBB → ETH (`earned_eth`)
    - If `earned_eth > spent_eth` (factoring in all expected tx/gas/marketplace fees), execute the trade

All steps should be performed atomically via contract with proper race-condition/profit checks.

---

## Main Actors & Data Sources

- **NFT marketplace**: Opensea (Base chain), Warplets collection
- **DutchAuction contract**: Address from `web/.env`: `NEXT_PUBLIC_DUTCH_AUCTION_ADDRESS`
- **$WARPGOBB DEX pool**: Uniswap v4 or appropriate onchain price source
- **ETH**: for purchasing and profit measurement

---

## Step-by-Step Procedure

### 1. Fetch Warplet Listings

- Periodically poll Opensea API/contract for active listings of Warplets on Base.
- For each listing, extract:
    - `tokenId`
    - `listing_price_eth`
    - seller, expiry, etc.

### 2. For Each Listed Warplet

- **Check exclusion criteria (e.g., blacklists, already gobbled, etc)**
- Simulate entire arbitrage sequence for each:

#### a. Estimate ETH to spend

- `spent_eth = listing_price_eth + platform fees (e.g. 2.5%) + est gas (all txs)`

#### b. Query Gobbler Payout

- Call DutchAuction contract to get current payout in $WARPGOBB for depositing a Warplet (`getCurrentPayout()` or similar).
- Confirm there's enough liquidity/the action is possible (not paused, auction open, etc).

#### c. Estimate Swap Output

- Query onchain for amount of ETH that would be received by swapping the above $WARPGOBB payout (`getAmountOut` on Uniswap/DEX contract).
- Deduct slippage, DEX fee, and realistic swap route impact.

#### d. Check Profitability

- If `earned_eth > spent_eth + minProfitThreshold`, proceed.

### 3. Execute Arbitrage ("Gobble Snipe")

- **Option A: Atomic Execution via Contract**
    - Ideal: Contract buys NFT, calls gobbler, swaps tokens, and refunds profit in a single atomic transaction.
    - Most likely, buying from Opensea requires an EOA due to order signature settlement.
    - *Possible solution*: Custom smart contract that implements:
        1. Calls Opensea Seaport to purchase NFT (buy ERC721 for ETH)
        2. Immediately deposits to Gobbler (`depositWarplet`)
        3. Swaps received $WARPGOBB for ETH (DEX router)
        4. Transfers ETH profit back to bot/operator address
    - All steps revert if not profitable.
- **Option B: Fast Sequential Execution**
    - If atomic contract isn't achievable (esp. Opensea buy), fall back to rapid sequential txs:
        1. Buy Warplet on Opensea (ETH → NFT)
        2. After confirmation, deposit to Gobbler (NFT → $WARPGOBB)
        3. After confirmation, swap $WARPGOBB → ETH
    - Must re-check preconditions at each step (if price/condition changes, abort).
    - Use Flashbots/private tx to avoid sandwiching.

### 4. Logging & Health

- Record every trade opportunity evaluated, profit calculation, success/failure, and reasons for skipping.
- Alerts on profitable but failed arbitrages.

---

## Configuration & Safety

- **Min profit threshold** (absolute or % of spent): configurable.
- **Cooldown / frequency**: poll interval, avoid rate limits/DoS.
- **Maximum trade values**: max ETH/item.
- **Fail-safe**: dry run/test mode.

---

## Edge Cases & Considerations

- **Outbid/outgunned scenario**: Listing no longer available, or snipe is too slow.
- **Auction state changes**: Ensure gobbler payout/balance hasn't changed/capped out (atomicity!).
- **Rate limits**: Opensea/DEX, etc.
- **Chain reorgs**: Not a huge deal, but be aware for UX.

---

## Implementation Sketch

- Backend service (Node.js or Python)
- Uses EOA/private key for all actions (maybe deploy helper contract)
- Requires ETH to operate, and approval for relevant DEX routers
- Integrates:
    - Opensea API/Seaport Base contracts
    - DutchAuction contract
    - Uniswap v4 (or onchain swap API)
- Robust error handling, dry run/testing mode