---
title: "feat: Upgrade auction buy animation with Silksong Void blob/combat/gleam sequence"
type: feat
date: 2026-03-26
---

# Upgrade Auction Buy Animation with Silksong Void Blob + Combat + Gleam

## Overview

Replace the current simple blob/tendril animation on gobbled warplets with the rich "Silksong Void" animation from the reference HTML. When a user buys a warplet, it flies to viewport center, a multi-hit combat sequence plays (tendrils thrashing, triple slash, shockwaves, sparks), then a gleam sweeps across the revealed warplet image.

## Current State

- `AuctionWarpletCanvas.tsx` — 200x200 canvas per card with simple blob (24 circular tendrils, basic heartbeat, single-pass strike with 3 slashes, sparks)
- `AuctionItem.tsx` — Click triggers `triggerStrike()` inline on the card canvas, shows "Sold!" after 2s
- No fly-to-center or full-screen overlay for the buy flow (only exists for the sell/gobble flow)

## Proposed Solution

### Phase 1: Upgrade the idle blob on each auction card

**File: `web/src/components/AuctionWarpletCanvas.tsx`**

Upgrade the per-card canvas animation to match the reference HTML's richer idle state:

- **OrbiterBlob with 6 bulges** (not 5) — larger strength range (0.2-0.45 vs 0.15-0.35), more organic shape
- **36 tendrils arranged along a square perimeter** (not 24 in a circle) — emanating outward from the warplet edges, matching the reference `buildScene()` layout with `innerHalf` inset
- **Corner tendrils** — 8 extra tendrils at corners (2 per corner) with longer reach (110-280px scaled)
- **Branching tendrils** — 30% of tendrils spawn a sub-branch at 30-50% along their length
- **White edge highlights** — 28% of tendrils get a flickering white stroke along one side
- **Richer heartbeat** (`getGlobalBreath`) — the reference uses a complex 16-second cycle with snap easing, double-pulse pattern, and power/speed decay. Replace the current simple 4s cycle
- **12-17 segments per tendril** (not 6-10) — smoother, longer curves
- **Tip particles** — during idle when extension > 0.7, spawn small dark particles at tendril tips

Scale all dimensions proportionally to fit the 200x200 card canvas (reference uses SQUARE_SIZE=70 in a full viewport; we scale up to ~120px image half with proportional tendril lengths).

Keep existing hover behavior (smoothly extends tendrils on mouseenter).

### Phase 2: Buy overlay — fly to center + combat sequence

**New file: `web/src/components/BuyOverlay.tsx`**

A full-screen fixed canvas overlay (z-50) that plays the complete combat sequence. Pattern follows `GobbleOverlay.tsx`:

```
Props: { fid: number; startRect: {x,y,w,h}; onDone: () => void }
```

**Animation timeline:**

1. **Fly-in** (0-0.8s): Warplet image animates from `startRect` to viewport center (reuse `FlyingWarplet` easing: `cubic-bezier(0.22, 1, 0.36, 1)`)
2. **Blob materializes** (0.8-2.0s): OrbiterBlob + tendrils fade in around the centered warplet, heartbeat begins
3. **Hit 1** (auto at 2.0s): Single slash, blob flinches (contract 0.4), sparks (40 particles, speed 150), screen shake intensity 10, hit-stop 60ms
4. **Recover 1** (0.6s hit + 1.6s recover): Tendrils weaken (weakenLevel=1: 30% power loss, 15% speed loss, 20% reach loss)
5. **Hit 2** (auto): Double slash, blob flinches harder (0.6), more sparks (70, speed 250), shake 18, hit-stop 80ms
6. **Recover 2** (0.6s + 1.6s): weakenLevel=2 (60% power loss, 30% speed, 40% reach)
7. **Finisher** (auto): Triple slash, 200 light burst particles + 40 fast streaks, 4 shockwave rings, shake 28, hit-stop 140ms. Tendrils go wild for 0.5s then collapse. Blob shudders then shrinks to 0.
8. **Resolve** (3.5s): Background brightens. Tendrils gone. Warplet image revealed with prize glow.
9. **Gleam** (at resolve): Diagonal white gleam sweeps across the warplet image (see Phase 3)
10. **Fade out** (after gleam): Overlay fades, callback `onDone()`

The full-screen canvas handles:
- Dark background fill (brightens during resolve)
- Fog radial gradient
- Ambient particles (35 small drifters)
- OrbiterBlob
- All tendrils (36 edge + 8 corner)
- Hit slashes, flashes, sparks, shockwaves, light burst
- Screen shake (translate canvas)
- Prize glow (radial gradient + border)
- Gleam effect over the warplet image area

The warplet image itself is drawn onto the canvas using `drawImage()` at center, so all effects composite naturally.

**File: `web/src/components/AuctionItem.tsx`**

Change click handler to dispatch to parent instead of triggering inline strike:

```
Props change: add onBuy?: (fid: number, rect: DOMRect) => void
```

On click: measure button bounding rect, call `onBuy(auction.fid, rect)`. Parent manages overlay state.

**File: `web/src/app/page.tsx`**

Add buy overlay state (mirrors the existing gobble overlay pattern):

```tsx
const [buyingFid, setBuyingFid] = useState<number | null>(null);
const [buyRect, setBuyRect] = useState<{x,y,w,h} | null>(null);
const [boughtFids, setBoughtFids] = useState<Set<number>>(new Set());
```

- `handleBuy(fid, rect)` — sets buyingFid + buyRect
- `handleBuyDone()` — adds fid to boughtFids set, clears buyingFid/buyRect
- Render `<BuyOverlay>` when buyingFid is set
- Pass `boughtFids` down to `AuctionItem` to show "Sold!" state

### Phase 3: Gleam animation

**Inside `BuyOverlay.tsx` — canvas-based gleam**

After the finisher resolves and the warplet is revealed, a diagonal white gleam sweeps across the warplet image area:

- Angled ~30 degrees from vertical
- Width: ~40px gradient band (transparent → white 0.4 opacity → transparent)
- Sweeps left-to-right across the warplet image bounds over ~0.6s
- Easing: ease-in-out
- Drawn using a rotated linear gradient that translates horizontally each frame

This is drawn as the final layer on the canvas after the warplet image, so it naturally clips to the visible area.

### Phase 4: Clean up AuctionWarpletCanvas strike code

After the buy overlay handles the full combat sequence, remove the inline strike animation from `AuctionWarpletCanvas.tsx`:

- Remove `triggerStrike` imperative handle
- Remove `AuctionCanvasHandle` type export (or keep if other code uses it)
- Remove strike-related state (strikeTime, striking, strikeCollapse)
- Remove spark spawning and slash drawing
- The component becomes purely the idle blob visualization

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/AuctionWarpletCanvas.tsx` | **Modify** | Upgrade idle blob: square-perimeter tendrils, branching, white edges, richer heartbeat, corner tendrils, tip particles. Remove strike code. |
| `web/src/components/BuyOverlay.tsx` | **Create** | Full-screen canvas overlay: fly-in, combat sequence (3 hits), shockwaves, sparks, gleam, fade-out |
| `web/src/components/AuctionItem.tsx` | **Modify** | Replace inline strike with `onBuy` callback that measures rect and dispatches to parent |
| `web/src/app/page.tsx` | **Modify** | Add buyingFid/buyRect/boughtFids state, render BuyOverlay, pass handlers to AuctionItem |

## Acceptance Criteria

- [x] Each auction card shows the richer blob with square-perimeter tendrils, branching, white edges, and organic heartbeat breathing
- [x] Clicking "Buy" on an auction card flies the warplet image to viewport center
- [x] Full combat sequence plays automatically: hit1 (single slash) → recover → hit2 (double slash) → recover → finisher (triple slash + shockwaves + light burst)
- [x] Tendrils weaken progressively through hits (shorter reach, slower heartbeat, less curl)
- [x] Blob collapses and disappears during finisher
- [x] After combat resolves, a diagonal white gleam sweeps across the warplet image
- [x] Overlay fades and auction item shows "Sold!" state
- [x] Existing sell/gobble flow is unaffected
- [x] No build errors or type errors

## Implementation Notes

- The reference HTML has a few syntax errors (`function Num)` should be `function triggerHit(hitNum)`, `(p - 0./ 0.28` should be `(p - 0.12) / 0.28`, `ctx.sav)` should be `ctx.save()`). These are corrected in the implementation.
- Canvas size for BuyOverlay: full viewport (`window.innerWidth x window.innerHeight`), same as GobbleOverlay
- Load warplet image via `new Image()` with `src=/warplets/warplet-{fid}.png` and draw with `ctx.drawImage()` once loaded
- All timing constants from the reference: `HIT_DURATION=0.6`, `RECOVER_DURATION=1.6`, `FINISHER_RESOLVE=3.5`
- The combat auto-advances (no user clicks needed) — hit1 starts immediately after blob materializes, subsequent hits chain automatically
- SQUARE_SIZE in the overlay canvas: scale to ~200px (the centered warplet image is ~350px, so the "inner" square the tendrils emanate from matches the image bounds)
