---
title: "feat: Tune auction card tendrils and add crawling overlay effect"
type: feat
date: 2026-03-26
---

# Tune Auction Card Tendrils + Add Crawling Overlay Effect

## Overview

Two changes to `AuctionWarpletCanvas.tsx`:

1. **Shorten tendrils** so they stay within the 200x200 canvas bounds instead of extending outside the card frame
2. **Add "crawl-over" tendrils** that periodically creep across the warplet image surface, making the warplets feel trapped/locked inside the void blob

## Current State

**File:** `web/src/components/AuctionWarpletCanvas.tsx`

Current dimensions (200x200 canvas):
- `IMG_HALF = 36` — image area half-size (image CSS is `w-[38%] h-[38%]` = ~76px)
- `INNER_HALF = 28` — tendril origin offset from center
- Edge tendrils: `maxLen: 45 + rand*75` → range **45-120px** — at full breath these easily exceed 100px from center, going past the canvas edge
- Corner tendrils: `maxLen: 55 + rand*70` → range **55-125px** — even worse, corners start at ~20px from center and extend 125px out
- Canvas half = 100px, so any tendril origin at ~28px + reach > 72px = off-canvas

No crawl-over effect exists. Tendrils only emanate outward from the image edges.

## Proposed Solution

### Change 1: Shorten tendrils to stay within canvas

Reduce `maxLen` ranges so that the longest tendrils stay within ~90px from center (canvas edge is 100px, leave 10px margin):

- **Edge tendrils:** `maxLen: 20 + rand*40` → range **20-60px**. Origin at ~28px from center, so max tip at 28+60 = 88px from center. Within bounds.
- **Corner tendrils:** `maxLen: 25 + rand*45` → range **25-70px**. Origin at ~20px from center, so max tip at 20+70 = 90px. Within bounds.
- **Slightly reduce width** to compensate for shorter length — thinner tendrils look better at short range:
  - Edge: `width: 2.5 + rand*4` (was `3 + rand*5.5`)
  - Corner: `width: 3.5 + rand*4.5` (was `4.5 + rand*5.5`)

### Change 2: Crawl-over tendrils

Add 3-4 "crawler" tendrils that periodically extend **across the warplet image surface** from one edge to the other, drawn **on top of the `<img>`** element:

**Implementation:** Add a second canvas (`crawlCanvasRef`) layered above the `<img>` with `z-10`. This canvas only draws the crawl tendrils, ensuring they render on top of the warplet picture.

**Crawler tendril behavior:**
- Each crawler has an independent timer with a random cycle period (~8-15s)
- **Idle phase** (~70% of cycle): crawler is retracted/invisible
- **Crawl-in phase** (~15% of cycle): tendril extends from one edge of the image, snaking across the surface toward the opposite side. Uses 2-3 wide control points that shift slightly each frame for an organic look.
- **Hold phase** (~5% of cycle): tendril rests across the image, slight oscillation
- **Retract phase** (~10% of cycle): tendril pulls back the way it came

**Visual style:**
- Dark semi-transparent fill: `rgba(0,0,0,0.7)` — dark enough to be visible over the bright warplet images
- Wider than background tendrils: base width ~6-10px, tapering to tip
- Subtle white edge highlight on one side for depth
- 2-3 crawlers active at staggered offsets so they don't all move at once
- Entry edges are randomized: top, bottom, left, right — with exit on the opposite or adjacent side

**Crawl path generation:**
- Start point: random position along one edge of the image area
- End point: random position along the opposite edge
- 2-3 control points between, offset perpendicular to the straight path by +-15px
- Control points drift slowly with `sin(time)` for organic movement
- Tendril extends by animating how many segments of the spine are drawn (progress 0→1 during crawl-in)

This approach keeps the crawl canvas small (same 200x200) and the logic self-contained within the existing component.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/AuctionWarpletCanvas.tsx` | **Modify** | Reduce tendril maxLen/width values; add second overlay canvas with crawl-over tendrils |

## Acceptance Criteria

- [ ] No tendrils extend outside the visible card area
- [ ] 3-4 crawler tendrils periodically creep across the warplet image surface
- [ ] Crawlers enter from a random edge and extend toward the opposite side
- [ ] Crawlers retract after a brief hold, creating a rhythmic "locked/trapped" feel
- [ ] Crawlers are staggered so they don't all fire simultaneously
- [ ] Existing hover behavior (tendrils extend on mouseenter) still works
- [ ] No build or type errors
