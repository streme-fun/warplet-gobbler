---
title: "feat: Integrate DaisyUI v4 with custom warplet color theme"
type: feat
date: 2026-03-25
---

# Integrate DaisyUI v4 with Custom Warplet Color Theme

## Overview

Add DaisyUI v4 as a Tailwind CSS plugin and define a custom `warplet` theme using the project's brand palette. Replace hardcoded gray Tailwind classes with DaisyUI semantic color tokens. Single dark theme only — no theme switching.

## Color Palette (from design)

| Role | Hex | DaisyUI Slot |
|------|-----|-------------|
| Primary (cyan) | `#00F5FF` | `primary` |
| Secondary (purple) | `#7B61FF` | `secondary` |
| Tertiary (pink) | `#FF007A` | `accent` |
| Neutral (dark) | `#0D0B14` | `neutral` |

## Proposed Solution

### 1. Install DaisyUI v4

Must be v4 (not v5) because the project uses Tailwind CSS v3.

```bash
pnpm --filter web add -D daisyui@4
```

### 2. Update `web/tailwind.config.js`

Add DaisyUI plugin and define the custom `warplet` theme:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        warplet: {
          "primary":           "#00F5FF",
          "primary-content":   "#0D0B14",

          "secondary":         "#7B61FF",
          "secondary-content": "#FFFFFF",

          "accent":            "#FF007A",
          "accent-content":    "#FFFFFF",

          "neutral":           "#0D0B14",
          "neutral-content":   "#C9C5D4",

          "base-100":          "#13111C",
          "base-200":          "#1A1726",
          "base-300":          "#221F2E",
          "base-content":      "#E8E5F0",

          "info":              "#00B4D8",
          "success":           "#00E676",
          "warning":           "#FFB800",
          "error":             "#FF3D71",
        },
      },
    ],
    darkTheme: "warplet",
    logs: false,
  },
};
```

Key decisions:
- `primary-content` set to dark (`#0D0B14`) for legibility on bright cyan
- `base-100/200/300` are a three-step dark gradient for surface depth
- `base-content` set to `#E8E5F0` (close to current `--foreground: #ededed`)
- `darkTheme: "warplet"` prevents DaisyUI's built-in dark theme from appearing
- Only the custom theme is included — no built-in themes, keeping CSS bundle small

### 3. Update `web/src/app/layout.tsx`

Add `data-theme="warplet"` to `<html>`:

```tsx
<html lang="en" data-theme="warplet">
  <body className="min-h-screen bg-base-100 text-base-content">
    <Providers>{children}</Providers>
  </body>
</html>
```

### 4. Update `web/src/app/globals.css`

Remove the CSS custom properties and `color`/`background` from body (DaisyUI handles these now). Preserve `font-family` since DaisyUI v4 does not set one:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

### 5. Update `web/src/app/page.tsx`

Replace hardcoded gray classes with DaisyUI semantic tokens:

| Current | Replacement | Reason |
|---------|-------------|--------|
| `text-gray-400` | `text-base-content/60` | Subtitle/secondary text |
| `text-gray-500` | `text-base-content/50` | Caption/tertiary text |
| `border border-gray-700` | `border border-base-content/20` | Card borders |

Convert cards to DaisyUI `card` component markup:

```tsx
{/* Before */}
<div className="border border-gray-700 rounded-lg p-6">
  <h2 className="text-xl font-semibold mb-2">The Gobbler</h2>
  <p className="text-sm text-gray-400 mb-4">...</p>
</div>

{/* After */}
<div className="card bg-base-200 border border-base-content/20">
  <div className="card-body">
    <h2 className="card-title">The Gobbler</h2>
    <p className="text-sm text-base-content/60">...</p>
  </div>
</div>
```

### 6. Update `web/src/app/providers.tsx`

Add `mode="dark"` to ConnectKitProvider so its modal matches the dark theme regardless of OS color scheme:

```tsx
<ConnectKitProvider mode="dark">{children}</ConnectKitProvider>
```

## Files Changed

| File | Change |
|------|--------|
| `web/package.json` | Add `daisyui@4` devDependency |
| `web/tailwind.config.js` | Add DaisyUI plugin + custom theme |
| `web/src/app/layout.tsx` | Add `data-theme`, body classes |
| `web/src/app/globals.css` | Remove CSS vars, keep font-family |
| `web/src/app/page.tsx` | Replace gray-* with semantic tokens, adopt card components |
| `web/src/app/providers.tsx` | Add `mode="dark"` to ConnectKitProvider |

## Acceptance Criteria

- [x] `pnpm --filter web build` succeeds
- [x] Page background is dark (`#13111C`), not white or black
- [x] Cards have visible depth (base-200 surface against base-100 background)
- [x] Card borders are visible but subtle
- [x] Text is readable at all levels (title, subtitle, caption)
- [x] ConnectKit button and modal render in dark mode
- [x] No Tailwind `gray-*` color classes remain in `page.tsx`
- [x] DaisyUI v4 is pinned (not v5)

## Risks

- **pnpm resolution**: `require("daisyui")` in tailwind.config.js must resolve. Default pnpm hoisting handles this. If it fails, add `shamefully-hoist=true` to `.npmrc` or use `require.resolve`.
- **ConnectKit style conflicts**: ConnectKit uses CSS-in-JS internally. DaisyUI's CSS reset should not conflict since ConnectKit renders in a portal, but verify visually.
