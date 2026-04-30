---
date: 2026-04-30
status: ready-to-plan
scope: lightweight
---

# Mobile bottom nav — replace bid/sell toggle

## Problem

On mobile, the only way to switch between the auction (Bid) and sell sections is a small fixed corner button at bottom-right that animates a "bid ↔ sell" label swap. It works, but it doesn't feel like a normal mobile app — there's no persistent indication of where you are or what's available, and the affordance is easy to miss.

## Goal

Give mobile users a familiar bottom tab bar with two tabs (Bid, Sell) that:
- Persistently shows which section they're in
- Lets them jump between sections with one tap
- Replaces the current corner toggle on mobile only

## Scope

### In scope
- New mobile-only bottom nav component with two tabs: **Bid** (jumps to `#auction`) and **Sell** (jumps to `#sell-section`).
- Active tab is driven by the existing `activeView` state in `web/src/app/page.tsx:707` (already updated by the scroll-blend hysteresis at lines 798–814).
- Tab tap behavior matches the existing `toggleView` (smooth scroll to the target section — see `web/src/app/page.tsx:828`).
- Hide the existing corner bid↔sell toggle on mobile (`sm:` breakpoint and below). Keep it on desktop unchanged.
- Hide the CA footer on mobile only. Desktop continues to show CA at the bottom.
- Hide the bottom nav while: gobbling, buy overlay active, claim-blocking gate active, boot overlay still showing — same conditions that hide the current toggle.
- Respect `env(safe-area-inset-bottom)` so the bar sits above the iOS home indicator.

### Out of scope (deferred)
- A third Stake tab — StratStaking has no UI section yet.
- A Wallet/Profile tab — wallet stays in the top nav.
- Replacing the desktop toggle. Desktop keeps the corner control.
- Reflowing the top nav.
- Any change to the section content itself.

### Outside this product's identity
- Heavy iOS-style chrome (rounded white cards, frosted blur stacks). The site has its own dark, gooey, Hollow-Knight-Abyss aesthetic — the nav should feel native to *that*, not generic iOS.

## User-facing behavior

- **Visibility:** Mobile (`< sm` ≈ <640px) only. `sm:hidden` on the nav, plus `hidden sm:flex` (or equivalent) on the existing corner toggle.
- **Layout:** Two equal-width tabs, full viewport width, fixed to bottom. Roughly 56–64px tall + safe-area inset.
- **Active state:** Current tab is visually distinct (brighter text, subtle accent — tied to the section's daisyUI color: `primary` cyan for Bid, `secondary` purple for Sell, or a shared white state with a thin top accent bar).
- **Tap behavior:** Smooth-scrolls to the target section using the existing `toggleView` logic. Active state updates as the user scrolls naturally (already handled by existing scroll listener).
- **Hidden states:** Same gating as current toggle — invisible during gobbling, buy overlay, claim-blocking gate, and pre-boot.
- **Reduced motion:** Honor `motion-reduce` like the current toggle (instant scroll if `prefers-reduced-motion`).

### Visual / copy direction (recommendation, not locked)
- Icons + lowercase labels matching the existing typographic voice (`bid`, `sell` in tracking-wide uppercase or all-lowercase — match the current toggle's vibe).
- Background: same `bg-black/85 backdrop-blur-md` recipe as the top nav for consistency.
- Top edge: a thin gobbler-lip SVG mirrored from the top nav, OR a simple 1px hairline. Recommend the hairline first — the gooey lip is a strong motif for the head; doubling it bottom-and-top risks looking themed-cute.

## Success criteria

- On mobile, opening the page shows a bottom tab bar with Bid and Sell tabs and a visible active state.
- Tapping a tab scrolls to that section and the active state updates accordingly.
- Scrolling the page updates the active tab without manual interaction (driven by existing `activeView`).
- The bid↔sell corner toggle no longer appears on mobile.
- CA footer no longer appears on mobile; still appears on desktop.
- All overlays (gobble, buy, claim, boot) hide the bottom nav.
- iOS home-indicator does not collide with the nav.

## Open / deferred questions

- **Icons or text-only?** Defaulting to text-only with an active accent — matches the minimalist aesthetic. Easy to add icons later.
- **Active state color:** primary (cyan) for both tabs, or per-section colors? Recommend single white-with-cyan-underline; per-section gets noisy.
- These can be resolved during implementation/preview iteration.

## Implementation hints (for planning, not prescriptive)

- New component: `web/src/components/MobileBottomNav.tsx`.
- Render in `web/src/app/page.tsx` next to the existing toggle button (around line 1144).
- Pass `activeView`, `toggleView`, and a `hidden` boolean derived from `gobbling || buyingFid || claimBlockingActive || !bootDone`.
- Add `sm:hidden` on the new nav; add `hidden sm:flex` (or equivalent) to the existing toggle.
- Add `hidden sm:block` to `CaFooter` wrapper, OR pass a `mobileHidden` prop.
- Adjust `pb-…` on the auction/sell sections so content isn't hidden behind the nav on mobile (likely `pb-[calc(4rem+env(safe-area-inset-bottom))]` on the bottom of the sell section).
