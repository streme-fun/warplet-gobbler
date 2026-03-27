// Mock constants — Superfluid streaming rate
export const MOCK_POT_START = 1247.38291746; // USDCx in pot at page load
export const MOCK_POT_RATE = 0.0823; // USDCx/sec streaming in (~7,110/day)
export const MOCK_POT_CAP = 2000; // pot capacity for fill bar
export const MOCK_PRICE_START = 891.42618; // current Dutch auction price
export const MOCK_PRICE_RATE = 0.0274; // USDCx/sec streaming into pot
export const MOCK_PRICE_CEIL = 1100; // starting auction price (for fill %)
export const MOCK_FLOOR_SECS = 35243; // seconds until floor price (~9h 47m)
export const MOCK_GOBBLED = 37;

// Mock auctions — Dutch auction prices ticking down visibly
export const MOCK_AUCTIONS = [
  {
    fid: 680,
    priceStart: 42_150.82,
    priceRate: -0.38,
    floor: 500,
    endsSecs: 14400,
  },
  {
    fid: 239,
    priceStart: 187_420.15,
    priceRate: -1.25,
    floor: 500,
    endsSecs: 21600,
  },
  {
    fid: 194,
    priceStart: 315_890.60,
    priceRate: -2.1,
    floor: 500,
    endsSecs: 7200,
  },
  {
    fid: 20,
    priceStart: 18_730.44,
    priceRate: -0.22,
    floor: 500,
    endsSecs: 28800,
  },
  {
    fid: 9,
    priceStart: 94_510.37,
    priceRate: -0.68,
    floor: 500,
    endsSecs: 18000,
  },
  {
    fid: 1000,
    priceStart: 256_340.91,
    priceRate: -1.75,
    floor: 500,
    endsSecs: 10800,
  },
] as const;

export type MockAuction = (typeof MOCK_AUCTIONS)[number];

// Mock warplets the user "owns" — same fids as background
export const MY_WARPLETS = [
  { fid: 1, name: "Warplet #1" },
  { fid: 3, name: "Warplet #3" },
  { fid: 69, name: "Warplet #69" },
  { fid: 99, name: "Warplet #99" },
  { fid: 616, name: "Warplet #616" },
  { fid: 4567, name: "Warplet #4567" },
] as const;
