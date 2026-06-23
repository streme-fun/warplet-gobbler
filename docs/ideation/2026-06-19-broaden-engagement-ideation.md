---
date: 2026-06-19
topic: broaden-engagement
focus: an interesting way for more people to engage with the app; today it's only bidders/sellers with little to do once bids climb high
mode: repo-grounded
---

# Ideation: Broaden Engagement Beyond Bidders & Sellers

## Grounding Context (Codebase)

Next.js 14 (App Router) Farcaster mini-app on Base. Core loop: **FeeHandler** (LP fees → swap to streaming $WARPGOBB) → **Dutch-auction "Gobbler"** (stream fills a pot; deposit a Warplet NFT to drain it) → **AuctionSell** (gobbled Warplets re-auctioned, FIFO queue) → **StratStaking** (proceeds stream to $WARPGOBB stakers). Screens: `/` auction (live pot ticker, queue, place bid, pay-to-bump position, claim won NFT), `/buy` (swap ETH→$WARPGOBB), `/sell` (deposit a Warplet to gobble), `/admin`. Aesthetic: dark/gooey Hollow-Knight "Abyss," "not generic iOS."

**Current participants:** bidders, sellers (Warplet owners), an arbitrage bot (`GobbleSniper`), $WARPGOBB holders, stakers.

**Engagement gap:** a casual visitor who doesn't own a Warplet, can't afford the (rising) bids, or doesn't stake has nothing to do but watch a number tick. StratStaking has no UI.

**Reusable primitives confirmed in repo:**
- Per-route Farcaster embeds + deep links: `web/src/lib/miniapp-embed.ts` (`buildMiniappEmbed`), `web/src/lib/resolve-initial-view.ts`
- Farcaster identity (FID, avatar): `web/src/hooks/useBidderProfile.ts`, `web/src/lib/neynar-bidder-profile.ts`, `/api/bidder-profile`
- Settlement "recent winners" scan: `web/src/lib/auction-settled.ts`, `settlement-cache.ts`, `log-scan.ts`, `LastAuctionWinnerBanner.tsx`
- Live rAF pot ticker: `web/src/components/StreamingNumber.tsx`
- Pay-to-bump queue: `web/src/hooks/useAuctionQueueBump.ts`, `AuctionQueueBumpPanel.tsx`
- Notification backbone (half-built): `/api/webhook/route.ts` captures `notifications_enabled` but only `console.log`s; `useMiniApp` stores `notificationDetails` but never sends; indexer `telegram-notifier.ts` proves event detection (operator-only)
- Gobbled-image pipeline: `generate-gobbled-image.ts`, `/api/gobbled-image`, `/api/gobbled-composite-image`
- `useMiniApp` exposes `openUrl`/`addMiniApp` but has **no `composeCast` wrapper yet**

**Past learnings:** No prior engagement learnings exist (greenfield). Reuse the recent-winners scan (own sourcing track), per-route embeds, the event/notification backbone, and Neynar identity. Honor the Abyss aesthetic and the no-StratStaking-UI constraint.

## Topic Axes
- A1 — Spectator participation (non-financial things a watcher can do live)
- A2 — Low-stakes economic on-ramps (skin-in-the-game for non-owners / priced-out bidders)
- A3 — Social distribution & arrival (Farcaster viral loops: share, discover, notify)
- A4 — Status, identity & competition (leaderboards, badges, streaks, reputation — the returning loop)
- A5 — Community influence over outcomes (curation/governance of proceeds & which Warplets get featured)

## Ranked Ideas

### 1. Free "Will it gobble?" prediction game
**Description:** A free, no-money prediction layer over the live auction. Spectators call outcomes — will this lot gobble before the price crosses X, who wins the slot, when the pot drains — earning non-transferable FID-keyed points. A "whisper" variant draws a live crowd-consensus price line across the pot ticker.
**Axis:** A1
**Basis:** `direct:` resolution is free — the `AuctionSettled` scan in `GobblerAuctionSection.tsx` already produces ground truth; FID identity is wired via `useBidderProfile`. `external:` Twitch Channel Points (non-transferable, sybil-safe, non-financial).
**Rationale:** Turns passive number-watching into a per-event decision loop for the priced-out majority, with no gambling/lottery surface.
**Downsides:** Needs a backend to store predictions/points (app is mostly client-side reads); points must stay non-transferable to avoid sybil farming.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Explored

### 2. Syndicate (pooled) bidding
**Description:** Many FIDs pledge small $WARPGOBB amounts into a shared bid on a specific queued Warplet; if the syndicate wins, the receipt is escrowed and split pro-rata. A "krewe" variant adds persistent captain-led crew identity + leaderboard.
**Axis:** A2
**Basis:** `external:` PartyDAO/PartyBid collective bidding. `direct:` bids route through `useAuctionSellBid`/`useAuctionSell777Bid`; gobble-then-relist economics already exist (`GobbleSniper.sol`, `DutchAuctionV2.gobbleFlash`).
**Rationale:** As bids climb, solo bidders shrink but small contributors grow — pooling re-opens the buyer role exactly when the stated problem bites.
**Downsides:** Fractional custody/escrow is real contract + legal work; heaviest item.
**Confidence:** 65%
**Complexity:** High
**Status:** Unexplored

### 3. Auto-cast win/gobble share cards → live lot
**Description:** At a win/gobble, one-tap compose a Farcaster cast featuring the gobbled image, deep-linking into the currently-live auction.
**Axis:** A3
**Basis:** `direct:` `buildMiniappEmbed`/`resolveInitialView` already produce per-route deep links; `/api/gobbled-composite-image` renders share-ready art; `useMiniApp` has no `composeCast` wrapper yet — one SDK call away.
**Rationale:** Harnesses peak-emotion (winning) with art already generated; near-zero incremental code for the cheapest acquisition channel.
**Downsides:** Opt-in vs auto-prompt is a consent/UX call; share fatigue risk.
**Confidence:** 88%
**Complexity:** Low
**Status:** Unexplored

### 4. Activate the dormant Farcaster notifications (return rail)
**Description:** Build the missing send path so events fire user-facing pings: "pot is ripe," "you've been outbid," "your lot is live," "streak ends in 6h."
**Axis:** A3 + A4
**Basis:** `direct:` `/api/webhook/route.ts` receives `notifications_enabled` and only logs; `useMiniApp` stores `notificationDetails` unused; indexer `telegram-notifier.ts` proves the event backbone (operator-only).
**Rationale:** Without notifications nobody returns when something happens — engagement caps at people who remember to reopen. The multiplier every other feature rides on.
**Downsides:** Server-side token storage + webhook signature verification; notification taxonomy/opt-in to avoid spam.
**Confidence:** 85%
**Complexity:** Low–Medium
**Status:** Unexplored

### 5. Persistent FID reputation & season standings
**Description:** Promote the ephemeral "recent winners" line into persistent FID-keyed standings (most gobbles, longest streak, biggest bid, prediction accuracy), framed as a season with a recap cast. Standing can gate privileges.
**Axis:** A4
**Basis:** `direct:` settlement history already scanned + cached (`settlement-cache.ts`, `log-scan.ts`); bidders resolve to avatars (`BidderAvatarName.tsx`). `external:` Farcaster friend-graph leaderboards; Nouns spectator ladder.
**Rationale:** A reason to return between auctions, and the hub that makes #1/#6/#7 reinforce each other instead of being isolated mini-games.
**Downsides:** Which behaviors you rank encodes product values; needs persistence + aggregation.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 6. Community curation of the next featured lot
**Description:** A free / earned-points lane to "spotlight" a queued Warplet, parallel to the existing flat-fee pay-to-bump. Top-voted lot gets a hero treatment + "going live" notification.
**Axis:** A5
**Basis:** `direct:` queue ordering is currently mutated only by the flat-fee bump (`useAuctionQueueBump.ts`, `AuctionQueueBumpPanel.tsx`); a curation/highlight layer rides alongside the existing strip. `external:` Nouns governance-of-attention.
**Rationale:** Gives penniless spectators sybil-resistant influence over what happens next, and creates appointment-viewing.
**Downsides:** Free votes vs paid bumps could cannibalize the 1M $WARPGOBB token sink.
**Confidence:** 72%
**Complexity:** Medium
**Status:** Unexplored

### 7. Fantasy-league draft of Warplets
**Description:** Draft a season roster of Warplets you don't own; score when "your" Warplets gobble, sell high, or climb the queue. Pure reputation, no token required, daily "set your lineup" loop.
**Axis:** A4
**Basis:** `external:` fantasy sports — proof that prediction + roster identity creates obsessive return-visits among non-owners. `direct:` every scoring input (gobbles, sell prices, bumps) is already an indexed event.
**Rationale:** The most literal answer to "more people, more to do once bids are high" — engages people who will never bid, on data already flowing.
**Downsides:** "Season scoring rules" is a real product-design project; best sequenced after #5.
**Confidence:** 68%
**Complexity:** High
**Status:** Unexplored

## Cross-Cutting Spine
- **Shared backbone:** a non-financial FID-keyed points/reputation primitive (sybil-safe via Neynar FID) makes #1, #5, #6, #7 compound. Build once, unlock four.
- **Arrival/return layer:** #3 (casts) + #4 (notifications) reuse primitives already ~80% present; without them engagement caps at the active-trader population.
- **Graduation ladder:** free prediction (#1) → standing (#5) → pooled bidding (#2) removes the cliff between watching free and risking money.

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Reaction rail / "feed the Gobbler" emotes (A1) | Folded into #1; lower depth, needs realtime infra |
| 2 | Staker Dividend Board / first StratStaking UI (A2) | Valuable & low-effort, but deepens an existing role / missing-UI build vs. broadening engagement — strong honorable mention |
| 3 | Collective naming & lore of gobbled Warplets (A5) | Duplicates #6 at lower leverage; moderation burden |
| 4 | Guess-the-gobbled-image pre-reveal beat (A1) | Narrow micro-moment; better as a detail inside #1 |
| 5 | Patron-saint adopt-a-Warplet sponsorship (A5) | Overlaps backer-pools + curation; fee-routing undecided |
| 6 | No-loss "backer" pools (A2) | Overlaps #2; heavier contracts; compliance-safe variant to revisit |
| 7 | Streak-to-bid / house-fronted first bid | Protocol fronting real capital is expensive & farm-prone |
| 8 | Ghost Warplet presence tile (A1) | Cosmetic, low leverage; polish within spectator work |
| 9 | Parimutuel "tote board" pool (A2) | Real-money betting = flagged gambling-regulatory risk; #1 gets engagement without exposure |
| 10 | Scheduled "Main Event" drops (A3) | Application of #3+#4, not a standalone build; revisit once those ship |
| 11 | Proceeds-direction governance vote (A5) | Heavier governance; enter A5 via lighter curation (#6) first |
