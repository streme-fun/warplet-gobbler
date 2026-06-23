---
date: 2026-06-22
status: draft-for-review
working-name: Feed the Gobbler (a.k.a. "Sip")
supersedes-context: docs/ideation/2026-06-19-broaden-engagement-ideation.md
---

# Feed the Gobbler — Plan

## One-liner

Let anyone feed the Gobbler **ETH** or **$WARPGOBB**. ETH is swapped to $WARPGOBB on the way in; the fed $WARPGOBB is **burned**. Feeders earn **SUP** as a pro-rata share of a fixed seasonal pool, weighted toward ETH feeds. Every feed is a real buy **+** a permanent burn **+** a live engagement moment — disguised as play.

## Why this, and why now

The engagement gap we started from ("nothing to do but watch a number tick") turned out to sit on a deeper economic bug:

- **The core loop recirculates $WARPGOBB instead of consuming it.** Bidding doesn't require buying — losers recycle the same stack and only the winner ever spends. Gobblers *earn* $WARPGOBB, bidders mostly *recycle* it, stakers withdraw it. External buy pressure is just people topping up.
- **So today's SUP-for-bidders allocation rewards recirculation, not buying.** We're spending our scarce SUP sub-budget on the one action that needs no new buy.
- **Distribution is not the lever.** The Farcaster audience is small and largely reached; viral acquisition is low-upside, and share-to-earn risks reading as pay-to-shill. The play is **depth on the existing audience**, not breadth.

We need a mechanic that **(a)** forces real buying, **(b)** sinks supply, **(c)** aims SUP at the buy, **(d)** deepens engagement, and **(e)** reads as *earned*, not bought.

## The principle: reward the sink, not the stack

Aim SUP at $WARPGOBB that is **permanently removed** from a wallet — not at $WARPGOBB that recirculates. You can't sink what you recycle, so **sinking forces buying.** Burning is deflationary, so every holder's incentives point the same way. And rewarding economic contribution (not broadcasting) keeps SUP legible as *earned*.

Thematic lock: the Gobbler already eats Warplets. Now **the Gobbler also eats $WARPGOBB.** A feed is the creature sipping; a burn is it digesting forever.

## The mechanic

**Two feed paths, one sink:**

1. **Feed ETH** → contract swaps ETH→$WARPGOBB via `StremeZapUniversal` → the resulting $WARPGOBB is **burned** (sent to a dead address / `burn`). *This path is a net new buy against the pool.*
2. **Feed $WARPGOBB** → burned directly. *A pure sink for people who already hold.*

**In exchange:** the feeder accrues **SUP**, sized as a pro-rata share of a fixed seasonal pool (see below), weighted so ETH feeds out-earn $WARPGOBB feeds.

**The buy is disguised as play.** Today "buy $WARPGOBB" bounces the user to a streme.fun swap tab — a speculation UI, high friction, easy to bail. "Feed the Gobbler" is *participation*: the user feeds a monster and a buy + burn falls out the bottom. Far better conversion than any swap widget, and it gives the priced-out spectator something to *do* live.

### Why it hits every constraint at once

| Constraint | How Feed-the-Gobbler delivers |
|---|---|
| Affects Streme's bottom line | ETH feeds swap against our pool → LP fees + Streme take, both captured |
| Make a little per interaction | Every feed routes through a swap we capture on |
| Make money on buys especially | Feeding ETH **is** the buy |
| Improve the flywheel | Burn → scarcity lifts $WARPGOBB value → LP fees worth more; (optional pot-split route, below, instead feeds the gobble loop) |
| Broaden SUP beyond bidders | Any feeder earns SUP — no Warplet, no bid required |
| Deliberate SUP allocation | Fixed pro-rata pool, ETH-weighted; we steer it exactly at buying |
| Not pay-to-shill | Rewards economic contribution, not broadcasting |
| Depth over breadth | A new, repeatable thing for the audience we already have |

## What already exists (reuse map)

The ETH→swap→sink pipe is **already in production** — `FeeHandler` collects WETH, swaps via `StremeZapUniversal`, and streams $WARPGOBB into the Gobbler ([`contracts/src/FeeHandler.sol:26`](../../contracts/src/FeeHandler.sol)). **Feed the Gobbler is just letting the crowd be the FeeHandler** — the same pipe the protocol runs automatically from LP fees, now exposed to users and crediting them SUP for pumping it by hand.

- `StremeZapUniversal` swap path — reuse from `FeeHandler`
- Superfluid streaming infra — already running (for the streaming variant, Phase 2)
- Per-route Farcaster embeds + deep links — `web/src/lib/miniapp-embed.ts`
- FID identity / avatars — `useBidderProfile`, `neynar-bidder-profile`, `/api/bidder-profile`
- Settlement scan + caching (for a leaderboard) — `auction-settled.ts`, `settlement-cache.ts`, `log-scan.ts`
- Live rAF ticker (for a "fed so far" counter) — `StreamingNumber.tsx`
- Existing buy entry points to retarget — `BuyWarpgobbLink.tsx`, `warpgobbBuy.ts`

## Routing decision: burn-primary

Fed $WARPGOBB is **burned** by default. Burn was chosen over feeding the pot because it:

- **Is a true sink** (the pot path eventually recirculates out through gobbling).
- **Helps every holder equally** via scarcity — cleanest incentive story.
- **Kills the feed-then-self-gobble exploit** outright: there's nothing in the pot to self-gobble, so a Warplet holder can't farm SUP by feeding a pot and draining it themselves.

**Lever retained:** route a configurable split (e.g. `X%` burn / `100−X%` to pot) if we later decide to favor the gobble→auction→staker loop over pure deflation. Default `X = 100`.

## SUP allocation: pro-rata seasonal pool, ETH-weighted

The WARPGOBB SUP sub-budget is fixed and currently fully spent on bidders — so this is a **deliberate reallocation**, not free money.

- **Pro-rata, not fixed-rate.** Feeders **split the season's SUP pool pro-rata** by weighted-$WARPGOBB-fed. Never promise "X SUP per ETH" — that risks blowing the fixed budget or being gamed. Pro-rata stays inside budget at any volume and turns the whole thing into a **competitive leaderboard** (the return loop) for free.
- **ETH-weighted.** ETH feeds (net new buys) earn a multiplier over direct $WARPGOBB feeds (mere sinks). We control allocation — point it at the action that actually drives volume.
- **The bidder question (open):** does the feeder pool come *out of* the bidder slice, or do bidders also migrate to earning SUP by sinking? Resolve before launch.

## Phasing

**Phase 1 — discrete feeds (ship first).**
One-tap "feed N ETH / N $WARPGOBB." Swap-on-deposit reusing the `FeeHandler` / `StremeZapUniversal` path; burn; SUP credited; "fed so far" + leaderboard UI on the live auction screen. No keeper, no streaming. Reuses a proven swap pattern almost verbatim.

**Phase 2 — streaming feeds (the on-brand endgame).**
Open a Superfluid flow that continuously feeds + continuously earns SUP. Needs a keeper to batch ETH→$WARPGOBB swaps and manage slippage. Gorgeous and consistent with "everything here streams," but strictly more infra — sequence after Phase 1 proves demand.

**Phase 3 — optional extensions.**
Configurable pot-split routing; predict-by-micro-burn (each prediction burns a trivial amount, prizes are SUP-only → engagement for the priced-out with no gambling surface); a staking SUP surface (locks supply, finally builds the missing StratStaking UI).

## Open decisions (need answers before build)

1. **Burn mechanism** — does $WARPGOBB (a Streme SuperToken) support a real `burn`, or do we send to a dead address? Confirm on-chain.
2. **Burn-only vs pot-split at launch** — ship pure burn (`X=100`) or open with a split? (Recommend pure burn for v1 simplicity + exploit-safety.)
3. **SUP source** — out of the bidder slice, or grow the WARPGOBB slice of the Streme budget?
4. **ETH-feed multiplier** — what weighting makes ETH feeds meaningfully more attractive without nuking the direct-feed path?
5. **Feed denominations / minimums** — fixed presets, free amount, floor to keep swap gas economical?

## Risks

- **Friction.** Every sink taxes participation; SUP is the counterweight. Works only if (SUP + fun) > feed cost. Start conservative on minimums and weighting.
- **Swap economics on small feeds.** Many tiny ETH→$WARPGOBB swaps eat gas + slippage. Set a sensible floor; batch in Phase 2.
- **Mercenary SUP farming.** Less acute than feed-the-pot (burn removes the self-gobble loop), but a whale could still dominate the pro-rata pool. Consider per-FID diminishing returns or a soft cap.
- **Cannibalizing the paid queue-bump sink.** If we also convert pay-to-bump to a burn, make sure the two sinks complement rather than compete.

## Explicitly out of scope (and why)

- **Share-to-earn-SUP** — reads as pay-to-shill; risks alienating the SUP-native community.
- **Viral / new-audience acquisition (Farcaster or X)** — audience is small and largely reached; low-upside and operationally hard. This plan is depth, not breadth.
- **An in-app fee-skimming swap router** — unnecessary; we already capture value at the pool/launch level as Streme.

## Questions for reviewers

- Is **burn-primary** the right call, or do you want a pot-split from day one to keep feeding the gobble→auction→staker loop?
- Are you comfortable **reallocating SUP off bidders** toward feeders, or should bidders keep a privileged slice?
- Does **"the buy disguised as play"** framing hold up — is feeding-ETH-to-a-monster a better buy surface than a swap UI, or does it obscure too much for users to trust?
- Right scope for **v1**: discrete ETH-only feed + burn + leaderboard — too thin, or exactly right?
