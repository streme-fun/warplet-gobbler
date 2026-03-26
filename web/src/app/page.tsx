"use client";

import { ConnectKitButton } from "connectkit";
import { useCallback, useRef, useState } from "react";
import AbyssBackground from "@/components/AbyssBackground";
import ParallaxBackground from "@/components/ParallaxBackground";
import Particles from "@/components/Particles";
import GobbleOverlay from "@/components/GobbleOverlay";
import GobblePeek from "@/components/GobblePeek";
import StreamingNumber from "@/components/StreamingNumber";
import AuctionItem from "@/components/AuctionItem";
import FlyingWarplet from "@/components/FlyingWarplet";
import {
  MOCK_PRICE_START,
  MOCK_PRICE_RATE,
  MOCK_AUCTIONS,
  MY_WARPLETS,
} from "@/lib/mock-data";

/* eslint-disable @next/next/no-img-element */

export default function Home() {
  const [gobbling, setGobbling] = useState(false);
  const [selectedFid, setSelectedFid] = useState<number | null>(null);
  const [flyingFid, setFlyingFid] = useState<number | null>(null);
  const [flyRect, setFlyRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const handleGobbleDone = useCallback(() => {
    setGobbling(false);
    setFlyingFid(null);
    setFlyRect(null);
    setSelectedFid(null);
  }, []);

  const handleSell = useCallback(() => {
    if (!selectedFid || gobbling || flyingFid) return;
    const el = cardRefs.current.get(selectedFid);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setFlyRect({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setFlyingFid(selectedFid);
  }, [selectedFid, gobbling, flyingFid]);

  return (
    <main className="min-h-screen relative overflow-hidden noise-overlay flex flex-col">
      {/* Gobble overlay — canvas jaws on top of everything */}
      {gobbling && <GobbleOverlay onDone={handleGobbleDone} />}

      {/* Centered warplet — fixed in viewport center during gobble */}
      {gobbling && flyingFid && (
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
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success">Base</span>
            </div>
            <ConnectKitButton />
          </div>
        </nav>

        {/* Single-focus layout: Gobbler + Deposit */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          {/* Title */}
          <div className="text-center mt-4 sm:mt-6 animate-fade-up-delay-1">
            <h1 className="text-3xl sm:text-7xl font-bold tracking-widest uppercase">
              THE ALWAYS HUNGRY
              <br />
              <span className="text-primary">WARPLET GOBBLER</span>
            </h1>
            <p className="mt-2 sm:mt-3 text-base-content/50 max-w-md mx-auto text-base sm:text-xl">
              Sell your Warplet to The Gobbler for its pot of $USDCx. <br />
              Or wait until the pot grows...
            </p>
            <p className="sm:mt-1 text-base-content/50 max-w-lg mx-auto text-xs sm:text-lg">
              ...and hope no one else steals your chance.
            </p>
          </div>

          {/* Deposit card — warplet picker + price + action */}
          <div className="mt-6 sm:mt-10 w-full max-w-sm animate-fade-up-delay-2">
            <div className="card bg-base-200/60 border border-primary/10 backdrop-blur-sm animate-card-glow">
              <div className="card-body items-center text-center gap-4 p-5 sm:p-6">
                <p className="text-sm sm:text-base text-base-content/50">
                  The Gobbler will pay
                </p>
                <div className="text-3xl sm:text-4xl font-mono font-semibold text-primary streaming-glow">
                  <StreamingNumber
                    start={MOCK_PRICE_START}
                    perSecond={MOCK_PRICE_RATE}
                    decimals={3}
                  />
                  <span className="text-base font-normal text-base-content/40 ml-2">
                    USDCx
                  </span>
                </div>
                <p className="text-sm sm:text-base text-base-content/50">
                  for your Warplet
                </p>

                {/* Warplet picker grid */}
                <div className="w-full pt-2">
                  <p className="text-xs text-base-content/40 mb-2">
                    Select a Warplet to sell
                  </p>
                  <div className="grid grid-cols-3 gap-2">
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
                        className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                          selectedFid === w.fid
                            ? "border-primary shadow-lg shadow-primary/30 scale-105"
                            : "border-base-content/10 hover:border-base-content/25"
                        } ${flyingFid === w.fid ? "opacity-0" : ""}`}
                      >
                        <img
                          src={`/warplets/warplet-${w.fid}.png`}
                          alt={w.name}
                          className="w-full aspect-square object-cover"
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
                  className="btn btn-primary w-full mt-1 hover:shadow-lg hover:shadow-primary/20 transition-shadow"
                  disabled={!selectedFid || !!flyingFid}
                  onClick={handleSell}
                >
                  {selectedFid
                    ? `Sell Warplet #${selectedFid} to The Gobbler`
                    : "Select a Warplet"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll prompt — Buy Warplet */}
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
        </div>
      </div>
      {/* end gobble fade wrapper */}

      {/* === Auction Section === */}
      <section
        id="auction"
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20"
      >
        <div className="w-full max-w-4xl rounded-2xl bg-base-200/40 border border-secondary/10 backdrop-blur-sm p-6 sm:p-10">
          <h2 className="text-xl sm:text-3xl font-bold tracking-widest uppercase mb-1">
            Gobbled Warplets
          </h2>
          <p className="text-sm text-base-content/40 mb-6 sm:mb-8">
            Dutch auction &mdash; price drops every second. Click to buy.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-4 sm:gap-6">
            {MOCK_AUCTIONS.map((auction) => (
              <AuctionItem key={auction.fid} auction={auction} />
            ))}
          </div>
        </div>

        <footer className="mt-12 sm:mt-16 text-center">
          <span className="text-sm text-base-content/20">
            WarpletGobbler &mdash; built on Base
          </span>
        </footer>
      </section>
    </main>
  );
}
