---
title: Remove blob and tendrils from BuyOverlay animation
type: refactor
date: 2026-03-26
---

# Remove blob and tendrils from BuyOverlay animation

Strip the blob shape and all tendrils from the BuyOverlay combat animation canvas, keeping the rest of the Silksong Void sequence intact (fly-in, hits, sparks, shockwaves, gleam, fade).

## Acceptance Criteria

- [x] No blob is rendered during any phase of the BuyOverlay animation
- [x] No tendrils are rendered during any phase of the BuyOverlay animation
- [x] No tendril-related glow (the subtle glow behind the blob) is rendered
- [x] The fly-in, hit slashes, hit flashes, sparks, shockwaves, gleam, fog, ambient particles, vignette, and fade-out continue to work as before
- [x] No dead code left behind — all blob/tendril types, data, and helper functions are removed

## Context

`web/src/components/BuyOverlay.tsx` is a single-file canvas animation (~1168 lines). The blob and tendrils account for roughly **half** the code:

| Section | Lines | Action |
|---------|-------|--------|
| `TendrilData` type + tendril array setup | 275–349 | **Delete** |
| `makeTendril()` | 351–380 | **Delete** |
| `blobBulges` array | 383–388 | **Delete** |
| `drawTendrilShape()` | 391–445 | **Delete** |
| `drawWhiteEdge()` | 447–491 | **Delete** |
| `drawBlob()` | 559–605 | **Delete** |
| `drawAllTendrils()` | 607–749 | **Delete** |
| `getFinisherTendrilScale()` | 146–154 | **Delete** |
| `getBlobStagger()` | 136–144 | **Delete** |
| Blob-behind glow block in `frame()` | 1074–1088 | **Delete** |
| `drawBlob()` call in `frame()` | 1091 | **Delete** |
| `drawAllTendrils()` call in `frame()` | 1094 | **Delete** |
| `SQUARE_SIZE`, `INSET`, `INNER_HALF` constants | 57, 299–300 | **Delete** (only used by blob/tendril sizing) |

### Constants to keep

- `IMG_SIZE`, `IMG_HALF` — still used for warplet image drawing and gleam clipping. Redefine `IMG_SIZE` standalone (currently derived from `SQUARE_SIZE`).

## MVP

### `web/src/components/BuyOverlay.tsx`

1. Remove the `TendrilData` type, `tendrils` array, `makeTendril`, `blobBulges`, `drawTendrilShape`, `drawWhiteEdge`, `drawBlob`, `drawAllTendrils`, `getFinisherTendrilScale`, `getBlobStagger`.
2. Remove the blob-behind glow block and the `drawBlob` / `drawAllTendrils` calls from `frame()`.
3. Replace `SQUARE_SIZE`-derived `IMG_SIZE` with a direct calculation:
   ```ts
   const IMG_SIZE = Math.min(W * 0.21, 160);
   const IMG_HALF = IMG_SIZE / 2;
   ```
4. Delete `SQUARE_SIZE`, `INSET`, `INNER_HALF` constants.
5. Verify `getStaggerFlinch()` and `getGlobalBreath()` — if they're no longer called anywhere after tendril removal, delete them too. (They may still be referenced by hit effects or phase logic; check before removing.)

## References

- Source file: `web/src/components/BuyOverlay.tsx`
- Related plan: `docs/plans/2026-03-26-feat-silksong-void-buy-animation-plan.md`
