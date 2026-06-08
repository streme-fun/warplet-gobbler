export type InitialView = "buy" | "sell";

/**
 * Where the resolved initial view came from. The caller uses this to decide
 * side effects: only `firstVisit` consumes the first-sell-visit localStorage
 * flag, and `claim` means the claim-blocking gate forced the view.
 */
export type ResolvedViewSource = "claim" | "route" | "firstVisit" | "default";

export type ResolveInitialViewInput = {
  /** From the URL: `/buy` → "buy", `/sell` → "sell", `/` → undefined. */
  routeInitialView?: InitialView;
  /** A gobbled-token claim is pending — the claim gate takes precedence. */
  claimBlockingActive: boolean;
  /** First time this browser has seen the app (no first-sell-visit flag yet). */
  isFirstSellVisit: boolean;
};

/**
 * Pure decision for which view the page should open to.
 *
 * Precedence: claim-blocking gate → explicit route → first-sell-visit → buy default.
 * The claim gate wins even on `/sell` so a user with a pending claim always
 * sees the claim/auction screen first; once the claim clears, the effect
 * re-runs and the route's view (e.g. "sell") applies.
 */
export function resolveInitialView({
  routeInitialView,
  claimBlockingActive,
  isFirstSellVisit,
}: ResolveInitialViewInput): { view: InitialView; source: ResolvedViewSource } {
  if (claimBlockingActive) return { view: "buy", source: "claim" };
  if (routeInitialView) return { view: routeInitialView, source: "route" };
  if (isFirstSellVisit) return { view: "sell", source: "firstVisit" };
  return { view: "buy", source: "default" };
}
