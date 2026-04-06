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
  {
    fid: 42,
    priceStart: 72_880.5,
    priceRate: -0.51,
    floor: 500,
    endsSecs: 13200,
  },
  {
    fid: 1337,
    priceStart: 201_004.0,
    priceRate: -0.95,
    floor: 500,
    endsSecs: 8400,
  },
  {
    fid: 314,
    priceStart: 45_200.0,
    priceRate: -0.31,
    floor: 500,
    endsSecs: 19200,
  },
  {
    fid: 888,
    priceStart: 310_125.75,
    priceRate: -2.0,
    floor: 500,
    endsSecs: 9600,
  },
  {
    fid: 2025,
    priceStart: 98_000.0,
    priceRate: -0.62,
    floor: 500,
    endsSecs: 15600,
  },
  {
    fid: 7777,
    priceStart: 412_999.0,
    priceRate: -2.35,
    floor: 500,
    endsSecs: 6000,
  },
  {
    fid: 1234,
    priceStart: 156_700.25,
    priceRate: -1.1,
    floor: 500,
    endsSecs: 20400,
  },
  {
    fid: 404,
    priceStart: 28_404.0,
    priceRate: -0.19,
    floor: 500,
    endsSecs: 24000,
  },
  {
    fid: 7,
    priceStart: 502_007.0,
    priceRate: -2.8,
    floor: 500,
    endsSecs: 4800,
  },
  {
    fid: 256,
    priceStart: 89_600.0,
    priceRate: -0.44,
    floor: 500,
    endsSecs: 16800,
  },
  {
    fid: 5000,
    priceStart: 175_500.0,
    priceRate: -1.05,
    floor: 500,
    endsSecs: 12000,
  },
  {
    fid: 11,
    priceStart: 66_011.0,
    priceRate: -0.28,
    floor: 500,
    endsSecs: 21600,
  },
  {
    fid: 999,
    priceStart: 229_999.0,
    priceRate: -1.55,
    floor: 500,
    endsSecs: 7200,
  },
] as const;

export type MockAuction = (typeof MOCK_AUCTIONS)[number];

/** Mock top bid when on-chain lot is not wired (display only). */
export const MOCK_FALLBACK_TOP_BID_AMOUNT = "12,400";

/** Mock high bidder for hero when not on-chain (zero = no bidder row). */
export const MOCK_FALLBACK_TOP_BIDDER =
  "0x0000000000000000000000000000000000000000" as const;

/** Mock skip-queue fee when on-chain fee is unavailable. */
export const MOCK_SKIP_QUEUE_FEE = 2500;

// Mock warplets the user "owns" — same fids as background
export const MY_WARPLETS = [
  { fid: 1, name: "Warplet #1" },
  { fid: 3, name: "Warplet #3" },
  { fid: 42, name: "Warplet #42" },
  { fid: 69, name: "Warplet #69" },
  { fid: 99, name: "Warplet #99" },
  { fid: 256, name: "Warplet #256" },
  { fid: 314, name: "Warplet #314" },
  { fid: 616, name: "Warplet #616" },
  { fid: 999, name: "Warplet #999" },
  { fid: 1337, name: "Warplet #1337" },
  { fid: 2025, name: "Warplet #2025" },
  { fid: 4567, name: "Warplet #4567" },
  { fid: 5000, name: "Warplet #5000" },
  { fid: 7777, name: "Warplet #7777" },
] as const;
