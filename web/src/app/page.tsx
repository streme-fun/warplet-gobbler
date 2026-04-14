"use client";

import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useMiniApp } from "@/hooks/useMiniApp";
import { useOwnedWarplets } from "@/hooks/useOwnedWarplets";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import {
  useDutchAuctionActions,
  useDutchAuctionPayoutStream,
  useDutchAuctionPayoutToken,
  useDutchAuctionPrice,
  useWarpgobbUsdPrice,
} from "@/hooks/useDutchAuction";
import { useAuctionSellAuction } from "@/hooks/useAuctionSell";
import { useAuctionSell777Bid } from "@/hooks/useAuctionSell777Bid";
import { useAuctionQueueStripFids } from "@/hooks/useAuctionQueueStripFids";
import AbyssBackground from "@/components/AbyssBackground";
import ParallaxBackground from "@/components/ParallaxBackground";
import Particles from "@/components/Particles";
import GobbleOverlay from "@/components/GobbleOverlay";
import GobblePeek from "@/components/GobblePeek";
import BuyOverlay from "@/components/BuyOverlay";
import GobblerAuctionSection from "@/components/GobblerAuctionSection";
import FlyingWarplet from "@/components/FlyingWarplet";
import StreamingNumber from "@/components/StreamingNumber";
import { warpletImageSrc } from "@/lib/warplet-image-src";
import {
  GOBBLE_TRANSACTION_REVERTED_FRIENDLY,
  formatGobbleSellTxError,
  formatUserFacingTxError,
} from "@/lib/format-tx-error";

/* eslint-disable @next/next/no-img-element */

/** Lerp between two SVG path strings that share the same command structure. */
function lerpPath(a: string, b: string, t: number): string {
  const numsA = a.match(/-?\d+\.?\d*/g) ?? [];
  const numsB = b.match(/-?\d+\.?\d*/g) ?? [];
  let i = 0;
  return a.replace(/-?\d+\.?\d*/g, () => {
    const va = parseFloat(numsA[i] ?? "0");
    const vb = parseFloat(numsB[i] ?? "0");
    i++;
    return (va + (vb - va) * t).toFixed(1);
  });
}

const MORPH_SHAPES = [
  {
    // Left tendril — tall & narrow (buy) → wide & curving (sell)
    buy: "M-50,900 C50,700 120,500 80,350 C40,200 -20,150 30,50 C60,-20 150,0 200,80 C250,160 180,300 200,450 C220,600 350,750 300,900 Z",
    sell: "M-50,900 C20,750 180,600 150,400 C120,200 50,100 100,0 C180,-30 280,60 320,180 C360,300 280,450 320,580 C360,720 450,820 380,900 Z",
    opacity: 0.25,
  },
  {
    // Right blob — compact (buy) → spreading tentacles (sell)
    buy: "M1440,200 C1350,180 1280,250 1250,350 C1220,450 1280,550 1200,620 C1120,690 1050,650 1000,720 C950,790 980,900 1060,900 L1440,900 Z",
    sell: "M1440,150 C1320,130 1220,200 1180,320 C1140,440 1200,500 1100,580 C1000,660 920,600 860,700 C800,800 850,900 950,900 L1440,900 Z",
    opacity: 0.2,
  },
  {
    // Central drip — thin flame (buy) → wider organic (sell)
    buy: "M700,0 C720,80 680,160 710,250 C740,340 800,380 780,480 C760,580 690,550 680,650 C670,750 720,800 700,900 C690,900 660,800 650,700 C640,600 610,580 630,480 C650,380 590,340 620,250 C650,160 610,80 630,0 Z",
    sell: "M680,0 C740,100 650,200 700,300 C750,400 840,420 800,530 C760,640 660,620 640,720 C620,820 690,860 660,900 C640,900 600,850 610,740 C620,630 550,610 590,510 C630,410 540,380 580,280 C620,180 570,90 620,0 Z",
    opacity: 0.18,
  },
  {
    // Mid-left drip
    buy: "M400,0 C420,60 380,120 410,200 C440,280 400,350 420,450 C430,500 410,520 400,550 C390,520 370,500 380,450 C400,350 360,280 390,200 C420,120 380,60 400,0 Z",
    sell: "M380,0 C440,80 350,160 400,260 C450,360 380,420 410,520 C420,570 390,600 370,630 C350,600 330,570 350,510 C370,420 300,350 360,250 C420,150 340,70 380,0 Z",
    opacity: 0.15,
  },
  {
    // Bottom wave
    buy: "M0,900 C100,800 300,820 500,780 C700,740 800,800 1000,760 C1200,720 1350,800 1440,750 L1440,900 Z",
    sell: "M0,900 C120,830 250,860 450,810 C650,760 750,830 950,790 C1150,750 1300,830 1440,780 L1440,900 Z",
    opacity: 0.2,
  },
];

function MorphingSilhouettes({ scrollBlend }: { scrollBlend: number }) {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {MORPH_SHAPES.map((shape, i) => (
        <path
          key={i}
          d={lerpPath(shape.buy, shape.sell, scrollBlend)}
          fill={`rgba(0,0,0,${shape.opacity})`}
        />
      ))}
    </svg>
  );
}

function MiniAppWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        className="btn btn-outline btn-xs text-xs px-2 py-0.5 min-h-0 h-auto leading-snug"
      >
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    );
  }

  const connector = connectors[0];
  return (
    <button
      onClick={() => connector && connect({ connector })}
      disabled={!connector}
      className="btn btn-primary btn-sm"
    >
      Connect Wallet
    </button>
  );
}

export default function Home() {
  const { isLoaded, context, isMiniApp } = useMiniApp();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [gobbling, setGobbling] = useState(false);
  const [warpletVisible, setWarpletVisible] = useState(true);
  const [selectedFid, setSelectedFid] = useState<number | null>(null);
  const [flyingFid, setFlyingFid] = useState<number | null>(null);
  const [flyRect, setFlyRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  // Buy overlay state
  const [buyingFid, setBuyingFid] = useState<number | null>(null);
  const [buyRect, setBuyRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [boughtFids, setBoughtFids] = useState<Set<number>>(new Set());
  const [bidding, setBidding] = useState(false);
  const [auctionBidError, setAuctionBidError] = useState<string | null>(null);
  const auctionSell = useAuctionSellAuction();
  const auctionQueueStripFids = useAuctionQueueStripFids();
  const { approveAndBid, isPending: bidTxPending } = useAuctionSell777Bid();
  const dutchAuctionPriceQuery = useDutchAuctionPrice();
  const currentPrice = dutchAuctionPriceQuery.data;
  const { symbol: payoutSymbol, decimals: payoutDecimals } =
    useDutchAuctionPayoutToken();
  const payoutStream = useDutchAuctionPayoutStream(
    currentPrice,
    payoutDecimals,
    dutchAuctionPriceQuery.dataUpdatedAt,
  );
  const { priceUsd: warpgobbPriceUsd } = useWarpgobbUsdPrice();
  const { gobbleWarplet, isWriting } = useDutchAuctionActions();
  const {
    warplets: ownedWarplets,
    isLoading: ownedWarpletsLoading,
    isError: ownedWarpletsError,
    warpletsConfigured,
  } = useOwnedWarplets();

  const walletConfirmedNoWarplets =
    isConnected &&
    warpletsConfigured &&
    !ownedWarpletsLoading &&
    !ownedWarpletsError &&
    ownedWarplets.length === 0;

  const pickerWarplets = useMemo(() => {
    if (!warpletsConfigured || !isConnected) {
      return [];
    }

    if (ownedWarpletsLoading && ownedWarplets.length === 0) {
      return [];
    }

    if (ownedWarpletsError) {
      return [];
    }

    if (ownedWarplets.length === 0) {
      return [];
    }

    return ownedWarplets.map((w) => ({
      fid: w.fid,
      name: w.name,
      imageSrc: w.imageSrc,
    }));
  }, [
    warpletsConfigured,
    isConnected,
    ownedWarpletsLoading,
    ownedWarpletsError,
    ownedWarplets,
  ]);

  const showWarpletPickerSkeleton =
    !warpletsConfigured ||
    !isConnected ||
    (warpletsConfigured &&
      isConnected &&
      !ownedWarpletsError &&
      ownedWarpletsLoading &&
      ownedWarplets.length === 0);

  const WARPLET_PICKER_SKELETON_COUNT = 8;

  useEffect(() => {
    if (
      selectedFid != null &&
      !pickerWarplets.some((w) => w.fid === selectedFid)
    ) {
      setSelectedFid(null);
    }
  }, [selectedFid, pickerWarplets, setSelectedFid]);

  const nowSecs = Math.floor(Date.now() / 1000);
  const auctionLot = auctionSell.auction;
  const auctionExpired =
    !!auctionLot &&
    !auctionLot.settled &&
    nowSecs >= Number(auctionLot.endTime);
  const auctionChainBidActive =
    auctionSell.configured &&
    !auctionSell.isError &&
    auctionLot != null &&
    auctionLot.tokenId > 0n;

  const auctionBidDisabled =
    !isConnected ||
    bidTxPending ||
    bidding ||
    (auctionChainBidActive &&
      (auctionSell.isPaused ||
        auctionExpired ||
        auctionSell.minNextBidAmount == null ||
        !auctionSell.bidTokenAddress));

  const [activeView, setActiveView] = useState<"sell" | "buy">("buy");
  const [scrollBlend, setScrollBlend] = useState(0); // 0 = buy (purple), 1 = sell (cyan)
  const [claimBlocking, setClaimBlocking] = useState(false);
  /** Hysteresis for jump-link label — avoids flip-flopping when scroll sits near 50% blend. */
  const viewHintScrollRef = useRef<"sell" | "buy">("buy");

  const rescueViewerDisplayName =
    context?.user != null
      ? (context.user.displayName ?? `FID ${context.user.fid}`)
      : null;

  const rescueViewerPfpUrl = (() => {
    const u = context?.user as
      | { pfpUrl?: string; pfp?: string; profileImageUrl?: string }
      | undefined;
    if (!u) return null;
    const url = u.pfpUrl ?? u.pfp ?? u.profileImageUrl;
    return typeof url === "string" && url.length > 0 ? url : null;
  })();

  // Scroll blend + buy/sell hint; rescue gate keeps sell section unmounted (no jump to sell).
  useEffect(() => {
    if (claimBlocking) {
      viewHintScrollRef.current = "buy";
      setActiveView("buy");
      setScrollBlend(0);
      window.scrollTo(0, 0);
      return;
    }

    let rafId = 0;
    let pending = false;
    const compute = () => {
      pending = false;
      const sellEl = document.getElementById("sell-section");
      if (!sellEl) return;
      const sellTop = sellEl.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const t = Math.max(0, Math.min(1, 1 - sellTop / vh));
      setScrollBlend(t);
      const prev = viewHintScrollRef.current;
      let next = prev;
      if (prev === "buy" && t >= 0.56) next = "sell";
      else if (prev === "sell" && t <= 0.44) next = "buy";
      if (next !== prev) {
        viewHintScrollRef.current = next;
        setActiveView(next);
      }
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [claimBlocking]);

  const toggleView = useCallback((view: "sell" | "buy") => {
    viewHintScrollRef.current = view;
    setActiveView(view);
    const target = view === "buy" ? "auction" : "sell-section";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const geckoPoolUrl =
    process.env.NEXT_PUBLIC_GECKOTERMINAL_POOL_URL ??
    "https://www.geckoterminal.com/base/pools/0x0000000000000000000000000000000000000000";

  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [isSelling, setIsSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  /** Snapshot for GobbleOverlay: live `currentPrice` hits 0 right after gobble mines. */
  const [chestPayout, setChestPayout] = useState<{
    tokens: number;
    usd: number | null;
  } | null>(null);

  const displayPrice = currentPrice ?? BigInt(0);
  const payoutAmount = Number(formatUnits(displayPrice, payoutDecimals));
  // USD quote fallback rules:
  // - if payout amount is 0 => show $0.00
  // - if the payout amount hasn't loaded yet => show a very conservative $50k estimate
  //   (assumes a hypothetical market cap).
  const FX_EST_MARKET_CAP_USD = 50_000;

  const isAmountMissing = currentPrice === undefined;

  const isDutchAuctionConfigured =
    CONTRACTS.dutchAuction.toLowerCase() !== ZERO_ADDRESS.toLowerCase();

  const payoutUsd: number | null = isAmountMissing
    ? isDutchAuctionConfigured
      ? FX_EST_MARKET_CAP_USD
      : 0
    : payoutAmount === 0
      ? 0
      : warpgobbPriceUsd != null
        ? payoutAmount * warpgobbPriceUsd
        : null;

  const handleChestReveal = useCallback(() => {
    setWarpletVisible(false);
  }, []);
  const handleGobbleDone = useCallback(() => {
    setGobbling(false);
    setFlyingFid(null);
    setFlyRect(null);
    setSelectedFid(null);
    setWarpletVisible(true);
    setChestPayout(null);
  }, []);

  const startSellAnimation = useCallback((): boolean => {
    if (!selectedFid || gobbling || flyingFid) return false;
    const el = cardRefs.current.get(selectedFid);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    setFlyRect({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setFlyingFid(selectedFid);
    return true;
  }, [selectedFid, gobbling, flyingFid]);

  const handleSell = useCallback(async () => {
    if (
      !selectedFid ||
      !isConnected ||
      !publicClient ||
      isSelling ||
      isWriting
    ) {
      return;
    }

    setSellError(null);
    setIsSelling(true);

    try {
      if (currentPrice === undefined) {
        setSellError("Waiting for Gobbler price — try again in a moment.");
        return;
      }
      const payoutWeiSnapshot = currentPrice;
      const chestTokens = Number(
        formatUnits(payoutWeiSnapshot, payoutDecimals),
      );
      const chestUsd =
        chestTokens === 0
          ? 0
          : warpgobbPriceUsd != null
            ? chestTokens * warpgobbPriceUsd
            : null;

      // On-chain min payout for this tx (1% slippage vs snapshot). Always abi-encoded into safeTransferFrom `data`.
      const minPrice = (payoutWeiSnapshot * BigInt(99)) / BigInt(100);
      const gobbleHash = await gobbleWarplet(selectedFid, minPrice);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: gobbleHash,
      });
      if (receipt.status === "reverted") {
        setSellError(GOBBLE_TRANSACTION_REVERTED_FRIENDLY);
        return;
      }

      setChestPayout({ tokens: chestTokens, usd: chestUsd });
      if (!startSellAnimation()) {
        setChestPayout(null);
        setSellError(
          "Could not start reveal animation — scroll to your Warplet and try again.",
        );
      }
    } catch (err) {
      setSellError(formatGobbleSellTxError(err));
    } finally {
      setIsSelling(false);
    }
  }, [
    selectedFid,
    isConnected,
    publicClient,
    isSelling,
    isWriting,
    currentPrice,
    payoutDecimals,
    warpgobbPriceUsd,
    gobbleWarplet,
    startSellAnimation,
  ]);

  const handleBuy = useCallback(
    async (
      fid: number,
      rect: { x: number; y: number; w: number; h: number },
    ) => {
      if (buyingFid) return;

      const a = auctionSell.auction;
      const canSubmitOnChain =
        auctionSell.configured &&
        !auctionSell.isError &&
        a != null &&
        a.tokenId > 0n &&
        !a.settled &&
        !auctionSell.isPaused &&
        Math.floor(Date.now() / 1000) < Number(a.endTime) &&
        auctionSell.minNextBidAmount != null &&
        auctionSell.bidTokenAddress != null;

      if (canSubmitOnChain) {
        setAuctionBidError(null);
        setBidding(true);
        try {
          if (!publicClient) {
            setAuctionBidError("Something went wrong. Try again in a moment.");
            return;
          }
          const hash = await approveAndBid({
            amount: auctionSell.minNextBidAmount!,
            bidTokenAddress: auctionSell.bidTokenAddress!,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          await auctionSell.refetchAuction();
          setBuyingFid(fid);
          setBuyRect(rect);
        } catch (err) {
          setAuctionBidError(formatUserFacingTxError(err));
        } finally {
          setBidding(false);
        }
        return;
      }

      setBuyingFid(fid);
      setBuyRect(rect);
    },
    [buyingFid, auctionSell, publicClient, approveAndBid],
  );

  const handleBuyDone = useCallback(() => {
    if (buyingFid) {
      setBoughtFids((prev) => new Set(prev).add(buyingFid));
    }
    setBuyingFid(null);
    setBuyRect(null);
  }, [buyingFid]);

  if (isMiniApp && !isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main
      className={`${
        claimBlocking ? "min-h-min" : "min-h-screen"
      } relative noise-overlay flex flex-col overflow-x-hidden ${
        claimBlocking ? "" : "overflow-hidden"
      }`}
    >
      {/* Buy overlay — Silksong Void combat sequence */}
      {buyingFid && buyRect && (
        <BuyOverlay
          fid={buyingFid}
          startRect={buyRect}
          onDone={handleBuyDone}
        />
      )}

      {/* Gobble overlay — canvas jaws on top of everything */}
      {gobbling && (
        <GobbleOverlay
          onDone={handleGobbleDone}
          onChestReveal={handleChestReveal}
          payout={chestPayout?.tokens ?? payoutAmount}
          payoutSymbol={payoutSymbol}
          payoutUsd={chestPayout?.usd ?? payoutUsd}
        />
      )}

      {/* Centered warplet — fixed in viewport center during gobble, fades out when chest appears */}
      {gobbling && flyingFid && warpletVisible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <img
            src={warpletImageSrc(flyingFid)}
            alt=""
            className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] rounded-2xl animate-breathe"
            draggable={false}
          />
        </div>
      )}

      {/* Flying warplet — animates from card position to center */}
      {flyingFid && flyRect && !gobbling && (
        <FlyingWarplet
          fid={flyingFid}
          startRect={flyRect}
          onArrived={() => setGobbling(true)}
        />
      )}

      {/* Hollow Knight Abyss texture — always visible */}
      <AbyssBackground />

      {/* Ambient gobbler peek — jaws hint at their presence */}
      <GobblePeek hidden={gobbling} />

      {/* Everything below fades out during gobble */}
      {/* Nav — fixed on top of everything */}
      <nav className="fixed top-0 left-0 right-0 z-[45]">
        <div
          className="relative flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 backdrop-blur-md transition-none"
          style={{
            backgroundColor: `rgba(0, 0, 0, 0.85)`,
          }}
        >
          {/* Left — logo */}
          <img
            src="/logo.jpeg"
            alt="WarpletGobbler"
            className="h-8 sm:h-10 w-auto rounded-md"
            draggable={false}
          />
          {/* Right — status + wallet */}
          <div className="flex items-center gap-2 sm:gap-3">
            {context?.user && (
              <span className="text-sm text-base-content/50">
                {context.user.displayName ?? `FID ${context.user.fid}`}
              </span>
            )}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full border border-[#0052FF]/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="text-xs text-[#4C82FB]">Base</span>
            </div>
            {isMiniApp ? (
              <MiniAppWalletButton />
            ) : (
              <ConnectKitButton.Custom>
                {({ isConnected, show, address, ensName }) => (
                  <button
                    onClick={show}
                    className="text-xs px-3 py-1.5 rounded-full border border-base-content/20 text-base-content/70 hover:border-base-content/40 hover:text-base-content transition-colors"
                  >
                    {isConnected
                      ? (ensName ??
                        `${address?.slice(0, 4)}…${address?.slice(-3)}`)
                      : "Connect"}
                  </button>
                )}
              </ConnectKitButton.Custom>
            )}
          </div>
        </div>
        {/* Gobbler lip border */}
        <svg
          className="w-full h-4 sm:h-5 block"
          viewBox="0 0 1200 20"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0 L0,16 Q80,18 160,10 Q240,2 320,6 Q400,14 480,8 Q540,2 600,2 Q660,2 720,8 Q800,14 880,6 Q960,2 1040,10 Q1120,18 1200,16 L1200,0 Z"
            fill="#000000"
            fillOpacity="1"
          />
        </svg>
      </nav>

      {/* Buy ↔ Sell — text jump link, bottom-left (above CaFooter z-[50] and full-width content) */}
      <button
        type="button"
        onClick={() => toggleView(activeView === "buy" ? "sell" : "buy")}
        className={`group fixed left-0 bottom-0 z-[55] flex items-center gap-1.5 pl-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] text-xs sm:text-sm font-medium tracking-[0.12em] uppercase text-white/80 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-safe:hover:scale-[1.02] ${
          gobbling || buyingFid || claimBlocking
            ? "pointer-events-none opacity-0 scale-[0.98]"
            : "opacity-100 scale-100"
        }`}
        aria-label={
          activeView === "buy"
            ? "Scroll to sell section"
            : "Scroll to buy section"
        }
      >
        <span className="relative inline-grid place-items-start">
          <span
            className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "buy"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1.5 pointer-events-none"
            }`}
            aria-hidden={activeView !== "buy"}
          >
            sell
          </span>
          <span
            className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "sell"
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1.5 pointer-events-none"
            }`}
            aria-hidden={activeView !== "sell"}
          >
            buy
          </span>
        </span>
        <span
          className="relative inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center"
          aria-hidden
        >
          <svg
            className={`absolute transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "buy"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 scale-90"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <svg
            className={`absolute transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-reduce:ease-out ${
              activeView === "sell"
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 scale-90"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </span>
      </button>

      <div
        className={`${
          claimBlocking ? "" : "flex-1"
        } flex flex-col transition-opacity duration-700`}
        style={{ opacity: gobbling ? 0 : 1 }}
      >
        {/* Scroll-blended rich background — purple (buy) → cyan (sell) */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            background: `
              linear-gradient(
                180deg,
                rgba(${Math.round(60 - 50 * scrollBlend)}, ${Math.round(20 + 40 * scrollBlend)}, ${Math.round(100 - 60 * scrollBlend)}, 1) 0%,
                rgba(${Math.round(80 - 70 * scrollBlend)}, ${Math.round(30 + 60 * scrollBlend)}, ${Math.round(130 - 80 * scrollBlend)}, 1) 40%,
                rgba(${Math.round(50 - 40 * scrollBlend)}, ${Math.round(15 + 35 * scrollBlend)}, ${Math.round(80 - 50 * scrollBlend)}, 1) 100%
              )
            `,
          }}
        />
        {/* Organic morphing cutout shapes — morph between buy ↔ sell states */}
        <MorphingSilhouettes scrollBlend={scrollBlend} />

        {/* Parallax warplet background — on top of color wash */}
        <ParallaxBackground />

        {/* === Auction Section (Buy) === */}
        {/* Claim gate: pt ≈ GobblePeek jaw + ~2rem breathing room + safe-area */}
        <section
          id="auction"
          className={`relative z-10 flex flex-col items-center px-4 sm:px-6 ${
            claimBlocking
              ? "pt-[calc(env(safe-area-inset-top)+8.0625rem)] sm:pt-[calc(env(safe-area-inset-top)+11.625rem)] pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-16"
              : "pt-36 sm:pt-56 pb-12 sm:pb-20"
          }`}
        >
          <GobblerAuctionSection
            auctionBidPlacedFids={boughtFids}
            onBid={handleBuy}
            bidDisabled={auctionBidDisabled}
            onClaimBlockingChange={setClaimBlocking}
            viewerDisplayName={rescueViewerDisplayName}
            viewerPfpUrl={rescueViewerPfpUrl}
          />
          {auctionBidError && (
            <p className="mt-4 max-w-xl mx-auto text-center text-xs text-error/90 break-words px-2">
              {auctionBidError}
            </p>
          )}
        </section>

        {/* === Sell Section === */}
        {!claimBlocking ? (
          <section
            id="sell-section"
            className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-12 sm:pt-20 pb-24 sm:pb-32"
          >
            {/* Title */}
            <div className="text-center animate-fade-up-delay-1 mt-16">
              <h2>Sell your Warplet to</h2>
              <h1 className="text-3xl sm:text-6xl font-bold tracking-widest uppercase">
                THE INSATIABLE
                <br />
                <span className="text-primary">WARPLET GOBBLER</span>
              </h1>
            </div>

            {/* Price + picker + action — compact layout */}
            <div className="mt-6 sm:mt-8 w-full max-w-4xl animate-fade-up-delay-2 text-center">
              <p className="text-sm sm:text-base text-base-content/50">
                The Gobbler will pay
              </p>
              <div className="text-4xl sm:text-6xl font-mono font-semibold text-primary streaming-glow">
                <StreamingNumber
                  start={payoutStream.start}
                  perSecond={payoutStream.perSecond}
                  smartMinSigFigs={6}
                  smartHideDecimalsIfIntegerDigitsGt={5}
                />
                <span className="text-base font-normal text-base-content/40 ml-2">
                  {payoutSymbol?.startsWith("$")
                    ? payoutSymbol
                    : `$${payoutSymbol}`}
                </span>
                <p className="text-xs sm:text-sm text-base-content/40 mt-1">
                  {isAmountMissing ? (
                    isDutchAuctionConfigured ? (
                      <>
                        ~$
                        {FX_EST_MARKET_CAP_USD.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                          minimumFractionDigits: 0,
                        })}
                      </>
                    ) : (
                      "(~$0.00)"
                    )
                  ) : payoutAmount > 0 && warpgobbPriceUsd == null ? (
                    "USD quote unavailable"
                  ) : (
                    <>
                      ~$
                      <StreamingNumber
                        start={payoutStream.start * (warpgobbPriceUsd ?? 0)}
                        perSecond={
                          payoutStream.perSecond * (warpgobbPriceUsd ?? 0)
                        }
                        decimals={2}
                        truncateFractionDigits
                        className="inline font-mono"
                      />
                    </>
                  )}
                </p>
              </div>
              <p className="text-sm sm:text-base text-base-content/50">
                for your warplet
              </p>

              {/* Warplet picker — horizontal scroll (width matches auction card column) */}
              <div className="w-full mt-4">
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => {
                        const el = document.getElementById("warplet-scroll");
                        if (el) el.scrollBy({ left: -300, behavior: "smooth" });
                      }}
                      className="w-7 h-7 rounded-full border border-base-content/15 flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const el = document.getElementById("warplet-scroll");
                        if (el) el.scrollBy({ left: 300, behavior: "smooth" });
                      }}
                      className="w-7 h-7 rounded-full border border-base-content/15 flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:border-base-content/30 transition-colors"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  id="warplet-scroll"
                  className="overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-hide"
                >
                  {warpletsConfigured && isConnected && ownedWarpletsError && (
                    <p className="text-xs text-error/80 px-1 text-center max-w-md mx-auto">
                      Couldn&apos;t load your Warplets right now. Make sure your wallet
                      is connected to Base, then try reconnecting.
                    </p>
                  )}
                  {warpletsConfigured &&
                    isConnected &&
                    !ownedWarpletsLoading &&
                    !ownedWarpletsError &&
                    ownedWarplets.length === 0 && (
                      <p className="text-xs text-base-content/50 px-1 py-4 text-center">
                        No Warplets in this wallet on Base.
                      </p>
                    )}
                  {showWarpletPickerSkeleton ? (
                    <div className="flex min-w-full justify-center">
                      <div className="flex gap-2 w-max">
                        {Array.from(
                          { length: WARPLET_PICKER_SKELETON_COUNT },
                          (_, i) => (
                            <div
                              key={`picker-sk-${i}`}
                              className="relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 border-base-content/10 snap-center pointer-events-none text-center"
                              aria-hidden
                            >
                              <div className="absolute inset-0 skeleton rounded-none" />
                              <span className="absolute bottom-0 inset-x-0 h-[22px] skeleton rounded-none border-t border-base-content/5" />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : pickerWarplets.length > 0 ? (
                    <div className="flex min-w-full justify-center">
                      <div className="flex gap-2 w-max">
                        {pickerWarplets.map((w) => (
                          <button
                            key={w.fid}
                            ref={(el) => {
                              if (el) cardRefs.current.set(w.fid, el);
                              else cardRefs.current.delete(w.fid);
                            }}
                            onClick={() =>
                              setSelectedFid(
                                selectedFid === w.fid ? null : w.fid,
                              )
                            }
                            className={`relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 snap-center transition-all duration-200 text-center ${
                              selectedFid === w.fid
                                ? "border-primary shadow-lg shadow-primary/30"
                                : "border-base-content/10 hover:border-base-content/25"
                            } ${flyingFid === w.fid ? "opacity-0" : ""}`}
                          >
                            <img
                              src={w.imageSrc}
                              alt={w.name}
                              className="w-full h-full object-cover"
                              draggable={false}
                              loading="lazy"
                              decoding="async"
                            />
                            <span className="absolute bottom-0 inset-x-0 text-[10px] py-0.5 bg-black/60 text-base-content/70 text-center">
                              #{w.fid}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                className={`btn w-full max-w-sm mx-auto mt-3 transition-shadow ${
                  selectedFid
                    ? "btn-primary hover:shadow-lg hover:shadow-primary/20"
                    : "border border-primary/30 text-primary/50 hover:border-primary/50 hover:text-primary/70"
                }`}
                disabled={
                  !!flyingFid ||
                  !selectedFid ||
                  !isConnected ||
                  isSelling ||
                  isWriting
                }
                onClick={selectedFid ? handleSell : undefined}
              >
                {!isConnected
                  ? "Connect wallet to sell"
                  : ownedWarpletsLoading
                    ? "downloading your warplets... "
                    : isSelling || isWriting
                      ? "Submitting..."
                      : selectedFid
                        ? `Sell Warplet #${selectedFid}`
                        : "Select a Warplet"}
              </button>
              {sellError && (
                <p className="mt-2 text-xs text-error/90 text-center max-w-md mx-auto break-words">
                  {sellError}
                </p>
              )}
            </div>
          </section>
        ) : null}

        {!claimBlocking ? (
          <div className="relative z-10 mt-6 sm:mt-8 pb-4" aria-hidden />
        ) : null}
      </div>
      {/* end gobble fade wrapper */}

      {/* Fixed footer — contract address (z-[50] sits above auction z-10; disable hit-testing during claim so the CTA isn’t covered) */}
      <CaFooter pointerThrough={claimBlocking} />
    </main>
  );
}

// Fall back to the deployed $LARPBOBB address if the env var isn't set (e.g. local dev),
// so the footer always shows a real address rather than zero.
const FOOTER_CA: Address =
  CONTRACTS.warpgobbToken !== ZERO_ADDRESS
    ? CONTRACTS.warpgobbToken
    : ("0x3042b035325393F3d72390C7E5d51F26fe1F0e61" as Address);

function CaFooter({ pointerThrough = false }: { pointerThrough?: boolean }) {
  const [copied, setCopied] = useState(false);
  const ca = FOOTER_CA;

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(ca)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard API can reject in non-secure contexts / iframes / when
        // permission is denied — silently no-op so we don't unhandle-reject.
      });
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[50] bg-black/90 backdrop-blur-sm border-t border-base-content/10 py-3 sm:py-4 px-4 text-center select-all ${
        pointerThrough ? "pointer-events-none cursor-default" : "cursor-pointer"
      }`}
      onClick={pointerThrough ? undefined : handleCopy}
    >
      <span className="text-xs sm:text-sm text-base-content/60 font-mono tracking-wide">
        CA: <span className="text-base-content/80">{ca}</span>
        {copied ? (
          <svg
            className="inline-block ml-1.5 w-3.5 h-3.5 align-middle relative -top-px text-primary/80"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="inline-block ml-1.5 w-3.5 h-3.5 align-middle relative -top-px text-base-content/40"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
        )}
      </span>
    </div>
  );
}
