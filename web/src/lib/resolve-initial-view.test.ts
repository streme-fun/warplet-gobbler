import { describe, it, expect } from "vitest";
import { resolveInitialView } from "./resolve-initial-view";

describe("resolveInitialView", () => {
  it("covers R1: /buy for a returning visitor lands on buy via the route", () => {
    expect(
      resolveInitialView({
        routeInitialView: "buy",
        claimBlockingActive: false,
        isFirstSellVisit: false,
      }),
    ).toEqual({ view: "buy", source: "route" });
  });

  it("covers R2: /sell for a returning visitor lands on sell (overrides the returning-visitor buy default)", () => {
    expect(
      resolveInitialView({
        routeInitialView: "sell",
        claimBlockingActive: false,
        isFirstSellVisit: false,
      }),
    ).toEqual({ view: "sell", source: "route" });
  });

  it("covers R3: / on a first visit defaults to sell (preserves existing behavior)", () => {
    expect(
      resolveInitialView({
        routeInitialView: undefined,
        claimBlockingActive: false,
        isFirstSellVisit: true,
      }),
    ).toEqual({ view: "sell", source: "firstVisit" });
  });

  it("covers R3: / on a returning visit defaults to buy", () => {
    expect(
      resolveInitialView({
        routeInitialView: undefined,
        claimBlockingActive: false,
        isFirstSellVisit: false,
      }),
    ).toEqual({ view: "buy", source: "default" });
  });

  it("covers R4: claim-blocking gate wins over an explicit /sell route", () => {
    expect(
      resolveInitialView({
        routeInitialView: "sell",
        claimBlockingActive: true,
        isFirstSellVisit: false,
      }),
    ).toEqual({ view: "buy", source: "claim" });
  });

  it("covers R4: claim-blocking gate wins over a first-sell-visit", () => {
    expect(
      resolveInitialView({
        routeInitialView: undefined,
        claimBlockingActive: true,
        isFirstSellVisit: true,
      }),
    ).toEqual({ view: "buy", source: "claim" });
  });

  it("an explicit /buy on a first visit stays on buy with source 'route' (does NOT consume the first-sell-visit flag)", () => {
    // The only branch where an explicit route precedes first-sell-visit. source
    // is 'route', not 'firstVisit', so HomeView does not write the localStorage
    // flag — a /buy visit must not change `/`'s future first-sell default.
    expect(
      resolveInitialView({
        routeInitialView: "buy",
        claimBlockingActive: false,
        isFirstSellVisit: true,
      }),
    ).toEqual({ view: "buy", source: "route" });
  });

  it("reports source 'claim' even when the route would also resolve to buy", () => {
    // view is identical to the route default, but source differs — HomeView keys
    // localStorage-write and scroll decisions off source, so this is pinned.
    expect(
      resolveInitialView({
        routeInitialView: "buy",
        claimBlockingActive: true,
        isFirstSellVisit: false,
      }),
    ).toEqual({ view: "buy", source: "claim" });
  });
});
