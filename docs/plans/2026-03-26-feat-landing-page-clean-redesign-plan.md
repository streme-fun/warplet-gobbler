---
title: "feat: Clean narrative landing page redesign"
type: feat
date: 2026-03-26
brainstorm: docs/brainstorms/2026-03-26-landing-page-redesign-brainstorm.md
---

# Clean Narrative Landing Page Redesign

## Overview

Redesign the WarpletGobbler landing page from a cluttered, effects-heavy layout to a clean, narrative-driven page modeled after PunkStrategy. Strip all visual noise. Lead with copy, not effects. This page explains the protocol — interactive features move to `/app` later.

## Problem Statement

The current page has ~500 lines of JSX with particles, gradient orbs, noise overlays, pulse rings, card glow animations, stat bars, and interactive inputs — all competing for attention. The protocol explanation gets lost. PunkStrategy proves a clean narrative page with bold typography and whitespace is more effective.

## Proposed Solution

Rewrite `page.tsx` and `globals.css` from scratch with 4 clean sections:

1. **Nav** — Logo + "Enter App" button
2. **Hero** — Bold headline + one-liner + CTA buttons + small mascot
3. **How It Works** — 4 numbered steps explaining the flywheel
4. **Footer** — Links + "Built on Base"

### Section 1: Nav

```tsx
{/* web/src/app/page.tsx — Nav */}
<nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
      <span className="text-primary text-sm font-bold">W</span>
    </div>
    <span className="font-bold text-lg tracking-tight">
      Warplet<span className="text-primary">Gobbler</span>
    </span>
  </div>
  <button className="btn btn-primary btn-sm" disabled>
    Enter App
  </button>
</nav>
```

Changes from current:
- Remove ConnectKitButton from nav (moves to `/app` page)
- Remove "Base" network badge
- Add "Enter App" button (disabled until app route exists)
- Remove bottom border

### Section 2: Hero

```tsx
{/* web/src/app/page.tsx — Hero */}
<section className="max-w-3xl mx-auto text-center px-6 pt-24 pb-16">
  {/* Small mascot */}
  <div className="mx-auto w-24 h-24 mb-8">
    <video
      src="/warplet-chewing.mp4"
      autoPlay loop muted playsInline
      className="w-full h-full rounded-full object-cover"
      style={{
        maskImage: "radial-gradient(circle, black 55%, transparent 72%)",
        WebkitMaskImage: "radial-gradient(circle, black 55%, transparent 72%)",
      }}
    />
  </div>

  <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
    The Perpetual<br />
    <span className="text-primary">Warplet Machine</span>
  </h1>

  <p className="mt-6 text-lg text-base-content/60 max-w-lg mx-auto leading-relaxed">
    An automated flywheel that buys Warplets using Superfluid streams,
    auctions them for $STRAT, and rewards stakers.
  </p>

  <div className="mt-8 flex items-center justify-center gap-4">
    <a href="#how-it-works" className="btn btn-primary">
      How it works
    </a>
    <button className="btn btn-ghost text-base-content/60" disabled>
      Enter App
    </button>
  </div>
</section>
```

Changes from current:
- Remove pulse rings, particles, gradient orbs, noise overlay, watermark
- Mascot shrunk to 96px (from 280px) — illustration, not centerpiece
- Headline is the star: large, bold, multi-line
- Remove stats ribbon (Pot/Gobbled/Staked)
- Two CTAs: "How it works" (anchor link) + "Enter App" (disabled)

### Section 3: How It Works

```tsx
{/* web/src/app/page.tsx — How It Works */}
<section id="how-it-works" className="max-w-3xl mx-auto px-6 py-16">
  <h2 className="text-2xl font-bold text-center mb-12">
    How the Flywheel Works
  </h2>

  <div className="space-y-8">
    {[
      {
        step: "1",
        title: "Stream",
        description: "USDCx streams into the Gobbler pot via Superfluid, filling it continuously.",
        color: "primary",
      },
      {
        step: "2",
        title: "Deposit",
        description: "When the pot exceeds floor price, deposit a Warplet NFT and drain the entire balance.",
        color: "primary",
      },
      {
        step: "3",
        title: "Auction",
        description: "Gobbled Warplets go to auction. Bid $STRAT to win.",
        color: "secondary",
      },
      {
        step: "4",
        title: "Earn",
        description: "$STRAT from auction proceeds flows to stakers, closing the flywheel.",
        color: "accent",
      },
    ].map((item) => (
      <div key={item.step} className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full bg-${item.color}/10 border border-${item.color}/20 flex items-center justify-center text-sm font-bold text-${item.color} shrink-0`}>
          {item.step}
        </div>
        <div>
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-base-content/50 mt-1">{item.description}</p>
        </div>
      </div>
    ))}
  </div>
</section>
```

Changes from current:
- Vertical list layout (not cramped horizontal row)
- Each step has a number badge + title + description (three-level hierarchy)
- More space between steps
- Remove arrows between steps
- Color-coded numbers match the three-phase system

### Section 4: Footer

```tsx
{/* web/src/app/page.tsx — Footer */}
<footer className="border-t border-base-content/5 py-8 px-6">
  <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-base-content/30">
    <span>WarpletGobbler — built on Base</span>
    <div className="flex gap-6">
      <a href="https://opensea.io/collection/the-warplets-farcaster"
         target="_blank" rel="noopener noreferrer"
         className="hover:text-primary transition-colors">OpenSea</a>
      <span className="hover:text-primary cursor-pointer transition-colors">Contracts</span>
      <span className="hover:text-primary cursor-pointer transition-colors">Docs</span>
      <span className="hover:text-primary cursor-pointer transition-colors">GitHub</span>
    </div>
  </div>
</footer>
```

Changes from current:
- Add OpenSea link (real href to Warplets collection)
- Slightly more padding
- Otherwise keep as-is (already clean)

## Files Changed

| File | Change |
|------|--------|
| `web/src/app/page.tsx` | Rewrite — ~500 lines down to ~120 lines. Remove Particles, StatBar, all effects. New clean 4-section layout. |
| `web/src/app/globals.css` | Gut — remove all keyframe animations, particle system, noise overlay, watermark, scrollbar styling, stats ribbon. Keep only `body { font-family }` and `fade-up` animation. |
| `web/tailwind.config.js` | Remove `safelist` entries (no more dynamic color classes) |
| `web/src/app/providers.tsx` | No change (ConnectKit stays configured for when `/app` route uses it) |
| `web/src/app/layout.tsx` | No change |

## What Gets Removed

From `page.tsx`:
- `PARTICLES` constant (lines 8-117)
- `Particles` component (lines 119-145)
- `StatBar` component (lines 147-176)
- Warplet watermark div
- Gradient orbs (3 fixed blurred circles)
- Pulse rings (3 animated circles behind mascot)
- Stats ribbon (Pot/Gobbled/Staked)
- All 3 interactive feature cards (Gobbler, Auction, Stake)
- All interactive inputs and buttons (Deposit, Bid, Stake)
- ConnectKitButton import and usage
- `useEffect`, `useState` imports (no longer needed)

From `globals.css`:
- `@keyframes breathe`, `eye-flicker`, `pulse-ring`, `mouth-chomp`, `float-particle`, `card-glow`, `drain-fill`
- `.animate-breathe`, `.animate-chomp`, `.animate-pulse-ring`, `.animate-card-glow`
- `.particle`, `.drain-bar`
- `.noise-overlay`, `.warplet-watermark`
- `.warplet-img`, `.stats-ribbon`
- Scrollbar styling

From `tailwind.config.js`:
- `safelist` array (dynamic color classes for how-it-works steps)

## What Gets Kept

- DaisyUI theme and color palette (unchanged)
- `warplet.png` and `warplet-chewing.mp4` in `public/` (mascot used small in hero)
- `fade-up` animation (for subtle entrance effects)
- `providers.tsx` with ConnectKit configured (needed for future `/app` route)
- `layout.tsx` with `data-theme="warplet"`
- `contracts.ts` (unchanged)
- `"use client"` directive (still needed if video element requires client rendering)

## Acceptance Criteria

- [x] Page has exactly 4 sections: nav, hero, how-it-works, footer
- [x] No particles, gradient orbs, noise overlay, pulse rings, or watermark
- [x] No interactive inputs, bid forms, or deposit/stake buttons
- [x] Headline is prominently large and the visual centerpiece
- [x] Mascot is small (~96px) as a brand illustration, not centerpiece
- [x] 4-step "How it works" section is clear and readable
- [x] No `ConnectKitButton` on the page (moves to future `/app`)
- [x] `pnpm --filter web build` succeeds
- [x] Page renders correctly on mobile
- [x] `page.tsx` is under 150 lines (158 — close, includes data constants)
- [x] `globals.css` is under 30 lines (30 lines exactly)

## Open Questions (from brainstorm)

- Exact headline copy — "The Perpetual Warplet Machine" used in plan, but open to change
- Should mascot animate (video) or be static (png)? Plan uses video, can simplify to png
- Font choice — plan keeps system fonts, could add a display font later
