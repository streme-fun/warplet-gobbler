# Buy Rewards Visualization

**Date:** 2026-03-27

## What We're Building

A horizontal "you receive" breakdown row placed **above the auction grid** showing the three rewards buyers get:

1. **Original Warplet NFT** — the actual warplet image (from `/warplets/warplet-{fid}.png`)
2. **Gobbled Warplet NFT** — the gobbled version (using `/gobbled-warplet.jpg`)
3. **$SUP tokens** — Superfluid streaming token reward

Layout: `[Warplet img] + [Gobbled Warplet img] + [$SUP icon]` in a row with `+` connectors, labels beneath each.

## Why This Approach

- Compact, scannable — users see what they get at a glance before browsing auctions
- Reuses existing image assets
- Doesn't add clutter to individual auction cards

## Key Decisions

- Placement: above auction grid, below the section header/description
- Style: icon row with `+` signs connecting three items
- Uses `gobbled-warplet.jpg` for the gobbled variant
- Generic warplet image for the "original" slot (or a placeholder silhouette)
- $SUP represented with a simple token icon/badge
