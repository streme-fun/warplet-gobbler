"use client";

import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { useCallback, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useMiniApp } from "@/hooks/useMiniApp";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import {
  useDutchAuctionActions,
  useDutchAuctionPayoutToken,
  useDutchAuctionPrice,
  useWarpgobbUsdPrice,
  useWarpletApproval,
} from "@/hooks/useDutchAuction";
import AbyssBackground from "@/components/AbyssBackground";
import ParallaxBackground from "@/components/ParallaxBackground";
import Particles from "@/components/Particles";
import GobbleOverlay from "@/components/GobbleOverlay";
import GobblePeek from "@/components/GobblePeek";
import BuyOverlay from "@/components/BuyOverlay";
import GobblerAuctionSection from "@/components/GobblerAuctionSection";
import FlyingWarplet from "@/components/FlyingWarplet";
import { MY_WARPLETS } from "@/lib/mock-data";

/* eslint-disable @next/next/no-img-element */

function MiniAppWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button onClick={() => disconnect()} className="btn btn-outline btn-sm">
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
  const { data: currentPrice } = useDutchAuctionPrice();
  const { symbol: payoutSymbol, decimals: payoutDecimals } =
    useDutchAuctionPayoutToken();
  const { priceUsd: warpgobbPriceUsd } = useWarpgobbUsdPrice();
  const { isApproved, refetchApproval } = useWarpletApproval(selectedFid);
  const { approveWarplet, gobbleWarplet, isWriting } = useDutchAuctionActions();

  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [isSelling, setIsSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  const displayPrice = currentPrice ?? BigInt(0);
  const payoutAmount = Number(formatUnits(displayPrice, payoutDecimals));
  const formattedPrice = payoutAmount.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    },
  );
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
  }, []);

  const startSellAnimation = useCallback(() => {
    if (!selectedFid || gobbling || flyingFid) return;
    const el = cardRefs.current.get(selectedFid);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setFlyRect({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setFlyingFid(selectedFid);
  }, [selectedFid, gobbling, flyingFid]);

  const handleSell = useCallback(async () => {
    if (!selectedFid || !isConnected || !publicClient || isSelling || isWriting) {
      return;
    }

    setSellError(null);
    setIsSelling(true);

    try {
      if (!isApproved) {
        const approveHash = await approveWarplet(selectedFid);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchApproval();
      }

      const minPrice = (displayPrice * BigInt(99)) / BigInt(100);
      const gobbleHash = await gobbleWarplet(selectedFid, minPrice);
      await publicClient.waitForTransactionReceipt({ hash: gobbleHash });

      startSellAnimation();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit sell transaction";
      setSellError(msg);
    } finally {
      setIsSelling(false);
    }
  }, [
    selectedFid,
    isConnected,
    publicClient,
    isSelling,
    isWriting,
    isApproved,
    approveWarplet,
    refetchApproval,
    displayPrice,
    gobbleWarplet,
    startSellAnimation,
  ]);

  const handleBuy = useCallback(
    (fid: number, rect: { x: number; y: number; w: number; h: number }) => {
      if (buyingFid) return;
      setBuyingFid(fid);
      setBuyRect(rect);
    },
    [buyingFid],
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
    <main className="min-h-screen relative overflow-hidden noise-overlay flex flex-col">
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
          payout={Number(formatUnits(displayPrice, payoutDecimals))}
          payoutSymbol={payoutSymbol}
          payoutUsd={payoutUsd}
        />
      )}

      {/* Centered warplet — fixed in viewport center during gobble, fades out when chest appears */}
      {gobbling && flyingFid && warpletVisible && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <img
            src={`/warplets/warplet-${flyingFid}.png`}
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
      <GobblePeek />

      {/* Everything below fades out during gobble */}
      <div
        className="flex-1 flex flex-col transition-opacity duration-700"
        style={{ opacity: gobbling ? 0 : 1 }}
      >
        {/* Parallax warplet background */}
        <ParallaxBackground />

        {/* Background gradient orbs */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-secondary/3 rounded-full blur-3xl" />
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-base-content/5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm sm:text-base font-bold">
                W
              </span>
            </div>
            <span className="font-semibold text-base sm:text-xl tracking-wide uppercase">
              Warplet Gobbler
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {context?.user && (
              <span className="text-sm text-base-content/50">
                {context.user.displayName ?? `FID ${context.user.fid}`}
              </span>
            )}
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success">Base</span>
            </div>
            {isMiniApp ? <MiniAppWalletButton /> : <ConnectKitButton />}
          </div>
        </nav>

        {/* Single-focus layout: Gobbler + Deposit */}
        <section className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 pt-16 sm:pt-24 pb-8 sm:pb-12">
          {/* Title */}
          <div className="text-center animate-fade-up-delay-1">
            <h2>Sell your Warplet to</h2>
            <h1 className="text-3xl sm:text-6xl font-bold tracking-widest uppercase">
              THE INSATIABLE
              <br />
              <span className="text-primary">WARPLET GOBBLER</span>
            </h1>
          </div>

          {/* Price + picker + action — compact layout */}
          <div className="mt-6 sm:mt-8 w-full max-w-2xl animate-fade-up-delay-2 text-center">
            <p className="text-sm sm:text-base text-base-content/50">
              The Gobbler will pay
            </p>
            <div className="text-4xl sm:text-6xl font-mono font-semibold text-primary streaming-glow">
              {formattedPrice}
              <span className="text-base font-normal text-base-content/40 ml-2">
                {payoutSymbol?.startsWith("$") ? payoutSymbol : `$${payoutSymbol}`}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-base-content/40 mt-1">
              {payoutUsd === null
                ? "USD quote unavailable"
                : `~$${payoutUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })}`}
            </p>
            <p className="text-sm sm:text-base text-base-content/50">
              for your warplet
            </p>

            {/* Warplet picker — horizontal scroll */}
            <div className="w-full mt-4 max-w-lg m-auto">
              <div className="flex items-center justify-between mb-2 ">
                <p className="text-xs text-base-content/40">
                  Select a Warplet to sell
                </p>
                <div className="flex gap-1">
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
                className="flex gap-2 overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-hide"
              >
                {MY_WARPLETS.map((w) => (
                  <button
                    key={w.fid}
                    ref={(el) => {
                      if (el) cardRefs.current.set(w.fid, el);
                      else cardRefs.current.delete(w.fid);
                    }}
                    onClick={() =>
                      setSelectedFid(selectedFid === w.fid ? null : w.fid)
                    }
                    className={`relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 snap-center transition-all duration-200 ${
                      selectedFid === w.fid
                        ? "border-primary shadow-lg shadow-primary/30"
                        : "border-base-content/10 hover:border-base-content/25"
                    } ${flyingFid === w.fid ? "opacity-0" : ""}`}
                  >
                    <img
                      src={`/warplets/warplet-${w.fid}.png`}
                      alt={w.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    <span className="absolute bottom-0 inset-x-0 text-[10px] py-0.5 bg-black/60 text-base-content/70">
                      #{w.fid}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className={`btn w-full max-w-sm mx-auto mt-3 transition-shadow ${
                selectedFid
                  ? "btn-primary hover:shadow-lg hover:shadow-primary/20"
                  : "border border-primary/30 text-primary/50 hover:border-primary/50 hover:text-primary/70"
              }`}
              disabled={
                !!flyingFid || !selectedFid || !isConnected || isSelling || isWriting
              }
              onClick={selectedFid ? handleSell : undefined}
            >
              {!isConnected
                ? "Connect wallet to sell"
                : isSelling || isWriting
                  ? "Submitting..."
                  : selectedFid
                    ? `Sell Warplet #${selectedFid}`
                    : "Select a Warplet"}
            </button>
            {sellError && (
              <p className="mt-2 text-xs text-error/90 break-all">{sellError}</p>
            )}
          </div>
        </section>

        {/* Scroll prompt — Buy Warplet
        <div className="relative z-10 pb-8 flex flex-col items-center">
          <button
            onClick={() =>
              document
                .getElementById("auction")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="group flex flex-col items-center gap-1 text-secondary/60 hover:text-secondary transition-colors"
          >
            <span className="text-sm sm:text-base tracking-widest uppercase">
              Buy Warplet
            </span>
            <svg
              className="w-5 h-5 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div> */}
      </div>
      {/* end gobble fade wrapper */}

      {/* === Auction Section === */}
      <section
        id="auction"
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20"
      >
        <GobblerAuctionSection
          auctionBidPlacedFids={boughtFids}
          onBid={handleBuy}
          bidDisabled={!isConnected}
          selectedWarpletTokenId={selectedFid}
        />

        <footer className="mt-12 sm:mt-16 pb-8 text-center text-sm text-base-content/30">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mb-6">
            <a
              href="https://opensea.io/collection/the-warplets-farcaster"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-base-content/60 transition-colors"
            >
              The Warplets
            </a>
            <a
              href="https://streme.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-base-content/60 transition-colors"
            >
              Streme
            </a>
            <a
              href="https://www.geckoterminal.com/base/pools/0x0000000000000000000000000000000000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-base-content/60 transition-colors"
            >
              Geckoterminal
            </a>
          </div>
          <p className="max-w-lg mx-auto text-xs text-base-content/20 leading-relaxed">
            WarpletGobbler has no affiliation with, and is not sponsored,
            approved, or endorsed by, the official Warplets project or the
            owners of the Warplets intellectual property. For more information
            on Warplets, visit their collection at:{" "}
            <a
              href="https://opensea.io/collection/the-warplets-farcaster"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-base-content/40 transition-colors"
            >
              opensea.io/collection/the-warplets-farcaster
            </a>
          </p>
        </footer>
      </section>
    </main>
  );
}
