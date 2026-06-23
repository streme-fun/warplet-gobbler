---
name: warplet-gobbler-stats-image
description: Create WarpletGobbler daily stats images for Farcaster/X. Use when the user asks to make, regenerate, revise, or finalize a WarpletGobbler stats graphic, especially with current top bid, Warplets floor, Warplets held, WARPGOBB market cap, or Hollow Knight-style WarpletGobbler art direction.
---

# WarpletGobbler Stats Image

Use this skill to turn current WarpletGobbler stats into a feed-performing square image.

## Workflow

1. If the user asks for current/today/final stats, run the sibling stats helper:

   ```bash
   node .codex/skills/warplet-gobbler-stats/scripts/fetch-stats.cjs
   ```

   This requires network access. Use `imageCopy` from the JSON output.

2. Read `references/stats-image-style.md` before writing the image prompt.

3. Use `image_gen` to generate the image unless the user explicitly asks for CLI/API image generation.

4. Keep the prompt strict about exact text. Generated image models often mutate token symbols and short labels; prefer fewer lines over a full dashboard.

5. After generation, report any text drift. Do not claim exactness if the rendered image changed a number or label.

## Default Copy Shape

Use the stats helper output when available:

```text
WarpletGobbler by $STREME

~{floorMultiple}x floor

Current top bid:
{topBidWarpgobb} $WARPGOBB (~${topBidUsd})

Warplets Floor: ~{floorEth} ETH
{holdings} Warplets held (+{heldDelta24h} today)
$WARPGOBB mkt cap: ~${marketCap}

Farcaster is fun.
```

If the delta is unknown or zero, omit the `(+N today)` parenthetical.

## Guardrails

- Do not include `.xyz`.
- Do not include queue length unless the user specifically asks for it.
- Do not include current auction length unless the user specifically asks for it.
- Do not use OpenSea 24h sales as Gobbler buys; use the stats helper's `heldDelta24h`.
- Do not place logos in the top-left or top-right unless the user asks. The only logo-like mark should be the small `$WARPGOBB` token badge row.
- Keep the image square and mobile-readable.
