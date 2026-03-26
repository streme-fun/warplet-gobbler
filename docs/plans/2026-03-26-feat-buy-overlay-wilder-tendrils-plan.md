---
title: "feat: BuyOverlay wilder tendrils on hits + smaller warplet"
type: feat
date: 2026-03-26
---

# BuyOverlay: Wilder Tendrils on Hits + Smaller Warplet

## Overview

Fix the BuyOverlay combat animation so tendrils **escalate** with each strike instead of diminishing. Currently `weakenLevel` reduces power, reach, curl, and frequency — making the void entity feel like it's dying. Instead, each hit should make the tendrils more frantic, longer, and more agitated, like a wounded beast thrashing harder. Also reduce the warplet image size slightly.

## File Changed

`web/src/components/BuyOverlay.tsx` — all changes are in this single file.

## Changes

### 1. Smaller warplet image

**Line 58** — reduce `IMG_SIZE` multiplier from `0.55` to `0.42`:

```ts
// Before
const IMG_SIZE = SQUARE_SIZE * 0.55;
// After
const IMG_SIZE = SQUARE_SIZE * 0.42;
```

This makes the warplet image smaller relative to the tendril area, giving the tendrils more visual prominence.

### 2. Invert tendril behavior: escalate instead of diminish

The `weakenLevel` variable (0 → 1 → 2) currently **reduces** everything. Flip all the multipliers so tendrils get wilder with each hit:

#### `getGlobalBreath()` (line 94-95)
```ts
// Before: tendrils get weaker
const power = 1 - weakenLevel * 0.3;
const speedMult = 1 - weakenLevel * 0.15;

// After: tendrils get more powerful and faster
const power = 1 + weakenLevel * 0.25;
const speedMult = 1 + weakenLevel * 0.2;
```

#### `drawAllTendrils()` — extension (line 624)
```ts
// Before: shorter reach
ext *= 1 - weakenLevel * 0.2;

// After: longer reach
ext *= 1 + weakenLevel * 0.3;
```

#### `drawAllTendrils()` — curl and frequency (lines 634-635)
```ts
// Before: less curly, slower
let curlMult = 1 - weakenLevel * 0.25;
let freqMult = 1 - weakenLevel * 0.2;

// After: more curly, faster
let curlMult = 1 + weakenLevel * 0.4;
let freqMult = 1 + weakenLevel * 0.35;
```

#### `getStaggerFlinch()` — hit recoil (lines 130-131)
Keep flinch on impact (tendrils snap inward momentarily), but recover to a **bigger** state:
```ts
// Before: hit1=0.4, hit2=0.6 contraction, recovers to diminished
const hitStrength = phase === "hit1" ? 0.4 : 0.6;
// ...
return 1 - hitStrength + recover * hitStrength * 0.7;

// After: same snap-in on impact, but snap OUTWARD during recovery
const hitStrength = phase === "hit1" ? 0.4 : 0.6;
// ...
return 1 - hitStrength + recover * hitStrength * 1.3;
```

This means tendrils contract on impact, then overshoot past their original length during recovery.

### 3. Blob also escalates

#### `drawBlob()` scale (line 567)
```ts
// Before: blob shrinks
let scale = 1 - weakenLevel * 0.12;

// After: blob grows slightly, more menacing
let scale = 1 + weakenLevel * 0.08;
```

### 4. Fog responds to escalation

#### Fog alpha (line 1030)
```ts
// Before: fog thins out
else if (weakenLevel > 0) fogAlpha = 1 - weakenLevel * 0.2;

// After: fog gets denser (more ominous)
else if (weakenLevel > 0) fogAlpha = 1 + weakenLevel * 0.15;
```

Cap fogAlpha to a reasonable max (the gradient stops already limit visual opacity).

## Acceptance Criteria

- [ ] After hit1, tendrils are visibly longer, curlier, and faster than idle
- [ ] After hit2, tendrils escalate further — noticeably more frantic
- [ ] Tendrils still snap inward on impact (flinch), then overshoot outward
- [ ] Finisher sequence still works (tendrils go wild then collapse to zero)
- [ ] Blob gets slightly larger with each hit, not smaller
- [ ] Warplet image is smaller relative to the tendril area
- [ ] No build errors
