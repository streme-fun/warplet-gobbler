# 🔐 Security Review — warplet-gobbler (contracts)

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | default                                                |
| **Files reviewed**               | `src/GobbledWarplets.sol` · `src/AuctionSell.sol` · `src/GobbleSniper.sol`<br>`src/DutchAuction.sol` · `src/DutchAuctionV2.sol` · `src/FeeHandler.sol`<br>`script/*.s.sol` (deploy scripts, inc. `DeployHelpers.sol`) |
| **Confidence threshold (1-100)** | 80                                                     |

---

## Findings

[95] **1. ERC777 push-refund DoS lets a malicious bidder win at reserve**

`AuctionSell._bid` · Confidence: 95

**Description**
`_bid` refunds the previous bidder with a bare `bidToken.transfer(lastBidder, lastAmount)` at line 265; because `bidToken` is an ERC777 SuperToken (AuctionSell registers itself as `ERC777TokensRecipient` in the constructor at lines 128–140, confirming ERC777 semantics), a contract bidder that registers a reverting `tokensReceived` implementer makes every subsequent outbid revert — locking themselves in as high bidder through `endTime` and winning at their reserve-level bid.

**Fix**

```diff
- if (lastBidder != address(0)) {
-     require(bidToken.transfer(lastBidder, lastAmount), "AuctionSell: refund failed");
- }
+ if (lastBidder != address(0)) {
+     pendingRefunds[lastBidder] += lastAmount;
+ }
```

```diff
+ mapping(address => uint256) public pendingRefunds;
+
+ function withdrawRefund() external nonReentrant {
+     uint256 amount = pendingRefunds[msg.sender];
+     require(amount > 0, "AuctionSell: no refund");
+     pendingRefunds[msg.sender] = 0;
+     require(bidToken.transfer(msg.sender, amount), "AuctionSell: refund failed");
+ }
```

Apply the same pull pattern to the `bidToken.transfer(proceedsRecipient, ...)` sites in `_bumpToFront` (line 296) and `_settleAuction` (line 436).

---

[75] **2. Minter rotation permanently strands winners' underlying Warplets**

`GobbledWarplets.rescueWarplet` · Confidence: 75

**Description**
`reserve()` records only `_reservedRecipient[tokenId] = to` with no reference to the minter that custodies the underlying Warplet, while `rescueWarplet` pulls it via `IERC721(minter.nft()).transferFrom(minter, to, wid)` using the *live* `minter` pointer (both overloads). If the owner calls `setMinter(newMinter)` while any reservations are outstanding, every subsequent `rescueWarplet` reverts because `newMinter` doesn't own the Warplet — the old AuctionSell still does — and no admin/user sweep exists to recover the stranded NFTs.

---

[75] **3. Irrevocable max allowance to FeeHandler turns admin compromise into full drain**

`DutchAuction.constructor` / `DutchAuctionV2.constructor` · Confidence: 75

**Description**
Both DutchAuction variants call `paymentToken.approve(_feeHandler, type(uint256).max)` with no getter, event, or revoker for the spender. `FeeHandler.setAuction` uses that approval to sweep the old auction's balance via `stremeToken.transferFrom(oldAuction, address(this), balance)` — a FeeHandler admin (DEFAULT_ADMIN_ROLE) can at any time call `setAuction(dutchAuction)` to transfer the DutchAuction's entire USDCx pot out, even when no migration is intended. Because the approval is immutable and the DutchAuction has no on-chain record of `feeHandler`, no post-deployment mitigation is possible.

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [95] | ERC777 push-refund DoS lets a malicious bidder win at reserve |
| 2 | [75] | Minter rotation permanently strands winners' underlying Warplets |
| 3 | [75] | Irrevocable max allowance to FeeHandler turns admin compromise into full drain |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **ERC777 push-payout DoS on `proceedsRecipient`** — `AuctionSell._settleAuction` / `_bumpToFront` — Code smells: `bidToken.transfer(proceedsRecipient, ...)` at lines 296 and 436, same ERC777 `tokensReceived` surface as Finding 1. If admin ever sets `proceedsRecipient` to a contract whose hook reverts (splitter, streaming router, ERC-4337 account), all settlements and queue bumps brick until admin rotates the recipient. Applied fix: route through pull-pattern (see Finding 1).
- **Rebalancer-role slippage is unbounded** — `FeeHandler.rebalance` — Code smells: rebalancer passes `minAmountOut` directly to `stremeZap.zap` (line 130–131) with no admin-set ceiling; a compromised rebalancer supplies `minAmountOut=1` and sandwiches their own tx.
- **`rebalance` bypasses `streamActive` guard** — `FeeHandler.rebalance` — Code smells: permissionless sibling `rebalanceFlowRate()` reverts with `StreamNotActive` (line 138) but `rebalance(uint256)` calls the same `_rebalanceFlowRate()` without that check, letting any REBALANCER_ROLE holder resume a stream after `setAuction` paused it.
- **Permissionless `rebalanceFlowRate` front-running** — `FeeHandler.rebalanceFlowRate` — Code smells: `flowRate = balanceOf(this) / targetDuration` is recomputed from current balance; anyone can time the call immediately after fee claim to lock in a favorable / unfavorable flow rate for the next interval.
- **`gobbleFlash` lacks reentrancy protection** — `DutchAuction.gobbleFlash` / `DutchAuctionV2.gobbleFlash` — Code smells: ERC777 `send(msg.sender, payout, ...)` invokes attacker-controlled `tokensReceived` while the pot is still credited; current CEI ordering (pot fully drained before external call) is safe, but any future partial-payout refactor would introduce a direct drain. Defense-in-depth `nonReentrant` is missing.
- **`snipe` + arbitrary Seaport calldata without reentrancy guard** — `GobbleSniper.snipe` — Code smells: caller-supplied `seaportCalldata_` executed via `seaport.call{value: ethForNft}(seaportCalldata_)` inside the ERC777 callback; missing `nonReentrant` lets a malicious Seaport order reenter `snipe` and clobber transient slots used by the outer `Sniped` event. Profit sweep targets the immutable trusted `recipient`, so no direct fund theft was traced — worth one pass to confirm no Seaport fulfillment path can induce Sniper to approve/transfer tokens beyond the atomic accounting.
- **Bump-vs-bid dispatch ambiguity + zero-fee footgun** — `AuctionSell.tokensReceived` — Code smells: routes to `_bumpToFront` iff `amount == queueBumpFee && userData.length == 64`; a user ERC777-sending exactly `queueBumpFee` with 64-byte userData has their intended bid silently reinterpreted as a bump fee. `setQueueBumpFee(0)` further enables free, permissionless queue reordering for any zero-amount send with 64-byte userData.
- **Token-id-0 sentinel is unverified** — `AuctionSell._bumpToFront` / `onERC721Received` — Code smells: the queue uses `0` as "no next" sentinel, safe only because Warplets never mint id 0; neither `onERC721Received` nor `_bumpToFront` asserts `tokenId != 0`. If `nft` is ever repointed at a collection that mints id 0, `_nextToken[unused] == 0` would satisfy `_nextToken[prev] == tokenId` for `tokenId = 0` with any `prev`.
- **Unbounded queue inflation** — `AuctionSell.onERC721Received` — Code smells: no per-sender cap, no queue length limit; an attacker owning many Warplets can flood the queue, pushing any specific token arbitrarily far back. Cost-prohibitive at floor prices but the invariant is absent.
- **FeeHandler zap trusts its own return value for slippage** — `FeeHandler._swapWethToToken` — Code smells: `stremeZap.zap(..., minTokenOut, ...)` is invoked but no post-swap `balanceOf`-delta `require(tokenOut >= minTokenOut)` is enforced, unlike the comment-documented defensive pattern in `AuctionSell.bid` (lines 202–206). A compromised / upgraded zap could under-deliver tokens while returning success.
- **`rescueWarplet` uses unsafe `transferFrom` for the Warplet pull** — `GobbledWarplets.rescueWarplet` — Code smells: `warplets.transferFrom(minter, to, wid)` at lines 131 and 164 never calls `onERC721Received`; a contract winner that accepts ERC20 bid tokens but not ERC721 would have the Warplet land irretrievably.
- **No rescue path for NFTs sent via plain `transferFrom`** — `DutchAuction` / `DutchAuctionV2` — Code smells: `onERC721Received` requires non-empty `data` (`abi.decode(data, (uint256))` reverts on empty), and the non-safe `transferFrom` bypasses the receiver entirely. Either path permanently locks the Warplet — no admin sweep exists.
- **Fee-on-transfer bidToken would desync bid accounting** — `AuctionSell.bid` / `_bid` — Code smells: `transferFrom(..., amount)` records `_auction.amount = amount` even if the token took a fee; refunds and proceeds transfers then exceed actual balance and revert. Intended WARPGOBB is not fee-on-transfer, so only reachable via constructor misconfig.
- **`bid()` may be permanently broken for ERC777 / SuperToken bidTokens** — `AuctionSell.bid` — Code smells: both `bid()` (line 193) and `tokensReceived()` (line 226) carry `nonReentrant`; `bidToken.transferFrom` inside `bid()` triggers `tokensReceived` on AuctionSell (registered implementer), which tries to re-acquire the guard and reverts. If WARPGOBB fires hooks on ERC20 `transferFrom`, the documented ERC20 entrypoint is silently unusable — users must use `send` directly.
- **`_bid` min-bid increment rounds down** — `AuctionSell._bid` — Code smells: `amount >= _auction.amount + ((_auction.amount * minBidIncrementPercentage) / 100)` truncates the percentage, so e.g. `_auction.amount=199, pct=5` accepts 208 as a 4.52 % increment. Standard Nouns pattern; flagged for awareness.
- **Deploy scripts never transfer ownership to a multisig/timelock** — `script/Deploy*.s.sol` — Code smells: `GobbledWarplets` retains deployer EOA as owner (constructor sets `Ownable(msg.sender)`), and deploy scripts call `setMinter` without a subsequent `transferOwnership` to an operational admin.
- **`GobbleSniper.withdrawNft` is permissionless** — `GobbleSniper.withdrawNft` — Code smells: anyone can trigger the sweep; all assets go to the immutable trusted `recipient`, so no theft path exists, but surprise triggering lets attackers time sweeps into unfavorable MEV conditions.

---

> ⚠️ This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
