#!/usr/bin/env node
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const webRequire = createRequire(path.join(REPO_ROOT, "web/package.json"));
const {
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
  parseAbiItem,
} = webRequire("viem");
const { base } = webRequire("viem/chains");

const DEFAULTS = {
  auctionSell: "0x2943Fd3DD84BB3Bf51d5C4b288f648ab45e4Fc3D",
  warplets: "0x699727f9e01a822efdcf7333073f0461e5914b4e",
  warpgobb: "0x1A339C38Ae22726F1A4235bCecf8f12aebE4C5E8",
  warpgobbV4PoolId:
    "0xde94c403afb374b80e6b46ec26b11c3ac31f3a4ffc3e1a83bb6dfa9e13260ff8",
  auctionDeployBlock: 47430889n,
  rpcUrl: "https://mainnet.base.org",
};

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return fs
    .readFileSync(file, "utf8")
    .split(/\n/)
    .reduce((env, line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) return env;
      env[match[1].trim()] = match[2]
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .trim();
      return env;
    }, {});
}

function address(value, fallback) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "") ? value : fallback;
}

function poolId(value, fallback) {
  return /^0x[a-fA-F0-9]{64}$/.test(value || "") ? value.toLowerCase() : fallback;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatUsd(value) {
  if (value == null) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 100) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

function formatTokenAmount(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatEth(value) {
  if (value == null) return null;
  if (value < 0.01) return value.toFixed(4);
  return value.toFixed(3);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "warplet-gobbler-stats" },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function getLogsChunked(client, { address, event, args, fromBlock, toBlock }) {
  const out = [];
  const step = 90_000n;
  for (let start = fromBlock; start <= toBlock; start += step + 1n) {
    const end = start + step > toBlock ? toBlock : start + step;
    const logs = await client.getLogs({ address, event, args, fromBlock: start, toBlock: end });
    out.push(...logs);
  }
  return out;
}

function selectWarpgobbPair(dex, envPoolId, warpgobbAddress) {
  const pairs = Array.isArray(dex.pairs) ? dex.pairs : [];
  const lowerPool = envPoolId.toLowerCase();
  const lowerToken = warpgobbAddress.toLowerCase();

  return (
    pairs.find((pair) => pair.pairAddress?.toLowerCase() === lowerPool) ||
    pairs.find(
      (pair) =>
        pair.baseToken?.address?.toLowerCase() === lowerToken &&
        pair.quoteToken?.symbol === "WETH" &&
        pair.dexId === "uniswap",
    ) ||
    pairs.find((pair) => pair.baseToken?.address?.toLowerCase() === lowerToken) ||
    pairs[0] ||
    null
  );
}

async function main() {
  const env = readEnv(path.join(REPO_ROOT, "web/.env.local"));

  const rpcUrl = env.NEXT_PUBLIC_BASE_RPC_URL || env.BASE_RPC_URL || DEFAULTS.rpcUrl;
  const auctionSell = address(env.NEXT_PUBLIC_AUCTION_SELL_ADDRESS, DEFAULTS.auctionSell);
  const warplets = address(env.NEXT_PUBLIC_WARPLETS_ADDRESS, DEFAULTS.warplets);
  const warpgobb = address(env.NEXT_PUBLIC_WARPGOBB_TOKEN_ADDRESS, DEFAULTS.warpgobb);
  const envPoolId = poolId(
    env.NEXT_PUBLIC_WARPGOBB_WETH_POOL_ID ||
      env.NEXT_PUBLIC_UNISWAP_V4_WARPGOBB_WETH_POOL_ID,
    DEFAULTS.warpgobbV4PoolId,
  );

  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

  const auctionAbi = parseAbi([
    "function auction() view returns ((uint256 tokenId,uint256 amount,uint256 startTime,uint256 endTime,address bidder))",
    "function currentAuction() view returns (uint256 tokenId,address highBidder,uint256 highBid,uint256 endTime)",
    "function queuedLength() view returns (uint256)",
    "function reservePrice() view returns (uint256)",
    "function minBidIncrementPercentage() view returns (uint8)",
  ]);
  const erc721Abi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
  const erc20Abi = parseAbi([
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ]);

  const [block, auction, currentAuction, queuedLength, reservePrice, incrementPct, holdings, decimals, symbol] =
    await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.readContract({ address: auctionSell, abi: auctionAbi, functionName: "auction" }),
      client.readContract({ address: auctionSell, abi: auctionAbi, functionName: "currentAuction" }),
      client.readContract({ address: auctionSell, abi: auctionAbi, functionName: "queuedLength" }),
      client.readContract({ address: auctionSell, abi: auctionAbi, functionName: "reservePrice" }),
      client.readContract({ address: auctionSell, abi: auctionAbi, functionName: "minBidIncrementPercentage" }),
      client.readContract({ address: warplets, abi: erc721Abi, functionName: "balanceOf", args: [auctionSell] }),
      client.readContract({ address: warpgobb, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: warpgobb, abi: erc20Abi, functionName: "symbol" }),
    ]);

  const transferEvent = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)");
  const approx24hBlocks = 43_200n;
  const from24h = block.number > approx24hBlocks ? block.number - approx24hBlocks : 0n;
  const custodyTransfers24h = await getLogsChunked(client, {
    address: warplets,
    event: transferEvent,
    args: { to: auctionSell },
    fromBlock: from24h,
    toBlock: block.number,
  });

  const [openSeaStats, openSeaCollection, dex] = await Promise.all([
    fetchJson("https://api.opensea.io/api/v2/collections/the-warplets-farcaster/stats"),
    fetchJson("https://api.opensea.io/api/v2/collections/the-warplets-farcaster"),
    fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${warpgobb}`),
  ]);

  const pair = selectWarpgobbPair(dex, envPoolId, warpgobb);
  if (!pair) throw new Error("Could not find a WARPGOBB Dexscreener pair");

  const priceUsd = num(pair.priceUsd);
  const marketCapUsd = num(pair.marketCap ?? pair.fdv);
  const floorEth = num(openSeaStats.total?.floor_price);
  const ethUsd = num(openSeaCollection.pricing_currencies?.listing_currency?.usd_price);
  const floorUsd = floorEth != null && ethUsd != null ? floorEth * ethUsd : null;
  const topBidWarpgobb = Number(formatUnits(auction.amount, decimals));
  const topBidUsd = priceUsd != null ? topBidWarpgobb * priceUsd : null;
  const floorMultiple = topBidUsd != null && floorUsd ? topBidUsd / floorUsd : null;
  const minNextBid =
    auction.amount === 0n
      ? reservePrice
      : auction.amount + (auction.amount * BigInt(incrementPct)) / 100n;

  const roundedMultiple = floorMultiple != null ? Math.round(floorMultiple) : null;
  const heldDelta24h = custodyTransfers24h.length;

  const imageCopy = {
    title: "WarpletGobbler by $STREME",
    hero: roundedMultiple != null ? `~${roundedMultiple}x floor` : "~__x floor",
    topBidLabel: "Current top bid:",
    topBid: `${formatTokenAmount(topBidWarpgobb)} $${symbol} (${formatUsd(topBidUsd)})`,
    floor: `Warplets Floor: ~${formatEth(floorEth)} ETH`,
    holdings:
      heldDelta24h > 0
        ? `${Number(holdings)} Warplets held (+${heldDelta24h} today)`
        : `${Number(holdings)} Warplets held`,
    marketCap: `$${symbol} mkt cap: ~${formatUsd(marketCapUsd)}`,
    footer: "Farcaster is fun.",
  };

  const result = {
    fetchedAt: new Date().toISOString(),
    sources: {
      baseRpc: rpcUrl.replace(/\?.*$/, "?..."),
      openseaStats: "https://api.opensea.io/api/v2/collections/the-warplets-farcaster/stats",
      openseaCollection: "https://api.opensea.io/api/v2/collections/the-warplets-farcaster",
      dexscreener: `https://api.dexscreener.com/latest/dex/tokens/${warpgobb}`,
      selectedDexPair: pair.url,
    },
    contracts: { auctionSell, warplets, warpgobb },
    stats: {
      blockNumber: block.number.toString(),
      blockTimestamp: Number(block.timestamp),
      auctionTokenId: auction.tokenId.toString(),
      auctionEndTime: Number(auction.endTime),
      currentAuctionTokenId: currentAuction[0].toString(),
      topBidWarpgobb,
      topBidUsd,
      minNextBidWarpgobb: Number(formatUnits(minNextBid, decimals)),
      reservePriceWarpgobb: Number(formatUnits(reservePrice, decimals)),
      minBidIncrementPct: Number(incrementPct),
      queuedLength: Number(queuedLength),
      holdings: Number(holdings),
      heldDelta24h,
      warpletsFloorEth: floorEth,
      warpletsFloorUsd: floorUsd,
      warpletsOpenSeaSales24h:
        openSeaStats.intervals?.find((row) => row.interval === "one_day")?.sales ?? null,
      warpgobbPriceUsd: priceUsd,
      warpgobbMarketCapUsd: marketCapUsd,
      floorMultiple,
    },
    imageCopy,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
