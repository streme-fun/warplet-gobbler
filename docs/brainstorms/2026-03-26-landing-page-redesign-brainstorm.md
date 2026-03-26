---
topic: Landing page redesign
date: 2026-03-26
status: decided
approach: Clean Narrative (PunkStrategy-style)
---

# Landing Page Redesign

## What We're Building

A clean, narrative-driven landing page that clearly explains the WarpletGobbler protocol. Modeled after PunkStrategy's proven structure: bold headline hero, numbered mechanism steps, social proof, footer. Strip all visual noise. This is an explanatory landing page only — interactive features (deposit, bid, stake) move to a separate `/app` route later.

## Why This Approach

The current page has too many competing visual effects (particles, gradient orbs, noise overlays, animated stat bars, pulse rings) that distract from the content. It looks like a hackathon project rather than a polished protocol. PunkStrategy proves that a simple, well-spaced narrative page with clear typography converts better and builds more trust.

## Key Decisions

1. **Keep dark theme** — dark background with cyan/purple/pink palette, but used with restraint (accents only, not background fills)
2. **Copy-centered hero** — big bold headline ("Feed the Gobbler" or similar), one-liner subtitle, CTA button. Mascot small/secondary.
3. **Landing page only** — no interactive cards, inputs, or bid forms. Just explain the protocol clearly. App features go to `/app` later.
4. **Strip visual noise** — remove particles, gradient orbs, noise overlay, pulse rings, card glow animations. Let typography and whitespace do the work.
5. **Clean narrative structure** — follow PunkStrategy's proven layout

## Proposed Page Structure

### Section 1: Nav
- Logo ("WarpletGobbler" or "W" mark) left
- "Enter App" button right (links to `/app` when ready, disabled for now)
- Clean, minimal, no background effects

### Section 2: Hero
- Large bold headline: "The Perpetual Warplet Machine" or "Feed the Gobbler"
- Subtitle: One sentence explaining the protocol (e.g., "An automated flywheel that buys Warplets using Superfluid streams, auctions them for $STRAT, and rewards stakers.")
- CTA: "How it works" (scrolls down) + "Enter App"
- Mascot: small, positioned to the side or as an inline illustration — not the centerpiece
- Wallet connect NOT in hero — move to nav or app page

### Section 3: How It Works (numbered steps)
Follow PunkStrategy's 4-step pattern:

1. **Stream** — "USDCx streams into the Gobbler pot via Superfluid, filling it continuously"
2. **Deposit** — "When the pot exceeds floor price, deposit a Warplet NFT and drain the entire balance"
3. **Auction** — "Gobbled Warplets go to auction. Bid $STRAT to win."
4. **Earn** — "$STRAT from auction proceeds flows to stakers, closing the flywheel"

Each step: number + title + one-sentence description. Clean cards or simple rows. Color-coded subtly (cyan, cyan, purple, pink) matching the three-phase system.

### Section 4: Stats / Social Proof
- Once live: "The Gobbler has consumed X Warplets" with a grid of gobbled NFT thumbnails
- Pre-launch: skip this section or show "Coming soon" with a teaser

### Section 5: Footer
- Links: Contracts, Docs, GitHub, OpenSea (Warplets collection)
- "Built on Base" badge
- Clean and minimal

## What to Remove

- Particles and float animations
- Gradient orbs (3 fixed blurred circles)
- Noise overlay (SVG fractalNoise)
- Warplet watermark tiled background
- Pulse rings behind mascot
- Card glow animation
- Interactive inputs (bid amount, deposit/stake buttons)
- StatBar progress bars
- Stats ribbon in hero
- Custom scrollbar styling (keep default)

## What to Keep

- Dark theme with warplet DaisyUI palette
- The Warplet mascot image (smaller, as illustration)
- The warplet-chewing.mp4 video (if used, keep small and subtle)
- Three-color system: primary=gobbler, secondary=auction, accent=staking
- ConnectKit (move to nav bar, keep `mode="dark"`)
- Font stack (system-ui)

## Open Questions

- Exact headline copy — "Feed the Gobbler"? "The Perpetual Warplet Machine"? Something else?
- Should the mascot animate (video) or be static (png)?
- Should we add a "Mission" section like PunkStrategy's "Buy and Sell Punks"?
- Font choice — stick with system fonts or add a display font for headlines?
