"use client";

import { ConnectKitButton } from "connectkit";
import { useEffect, useState } from "react";
/* eslint-disable @next/next/no-img-element */

// Deterministic particle positions to avoid hydration mismatch
const PARTICLES = [
  { id: 0, left: "20%", delay: "0s", size: 3, drift: "-10px", duration: "2.5s", color: "#00F5FF" },
  { id: 1, left: "35%", delay: "0.5s", size: 4, drift: "15px", duration: "3s", color: "#7B61FF" },
  { id: 2, left: "50%", delay: "1s", size: 2, drift: "-20px", duration: "2.8s", color: "#FF007A" },
  { id: 3, left: "65%", delay: "1.5s", size: 5, drift: "25px", duration: "3.2s", color: "#00F5FF" },
  { id: 4, left: "80%", delay: "2s", size: 3, drift: "-15px", duration: "2.6s", color: "#7B61FF" },
  { id: 5, left: "25%", delay: "0.8s", size: 4, drift: "10px", duration: "3.5s", color: "#FF007A" },
  { id: 6, left: "45%", delay: "2.2s", size: 2, drift: "-25px", duration: "2.4s", color: "#00F5FF" },
  { id: 7, left: "70%", delay: "0.3s", size: 3, drift: "20px", duration: "3.1s", color: "#7B61FF" },
  { id: 8, left: "30%", delay: "1.8s", size: 5, drift: "-5px", duration: "2.9s", color: "#FF007A" },
  { id: 9, left: "55%", delay: "2.5s", size: 2, drift: "30px", duration: "3.4s", color: "#00F5FF" },
  { id: 10, left: "75%", delay: "1.2s", size: 4, drift: "-18px", duration: "2.7s", color: "#7B61FF" },
  { id: 11, left: "40%", delay: "0.6s", size: 3, drift: "12px", duration: "3.3s", color: "#FF007A" },
];

function Particles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            bottom: "10%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            // @ts-expect-error CSS custom property
            "--drift": p.drift,
          }}
        />
      ))}
    </>
  );
}

function StatBar({
  label,
  value,
  fill,
  color,
}: {
  label: string;
  value: string;
  fill: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-base-content/50">{label}</span>
        <span className="font-mono text-base-content/80">{value}</span>
      </div>
      <div className="h-1.5 bg-base-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full drain-bar"
          style={{
            backgroundColor: color,
            // @ts-expect-error CSS custom property
            "--fill": `${fill}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden noise-overlay">
      {/* Warplet tiled background texture */}
      <div className="warplet-watermark" />

      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-base-content/5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs sm:text-sm font-bold">W</span>
          </div>
          <span className="font-bold text-sm sm:text-lg tracking-tight">
            Warplet<span className="text-primary">Gobbler</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success">Base</span>
          </div>
          <ConnectKitButton />
        </div>
      </nav>

      {/* Hero: The Warplet */}
      <section className="relative z-10 flex flex-col items-center pt-6 sm:pt-12 pb-4 sm:pb-8 px-4 sm:px-6">
        <div className="relative animate-fade-up">
          {/* Pulse rings behind the warplet */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 sm:w-64 sm:h-64 rounded-full border border-primary/20 animate-pulse-ring" />
            <div
              className="absolute w-40 h-40 sm:w-64 sm:h-64 rounded-full border border-secondary/20 animate-pulse-ring"
              style={{ animationDelay: "1s" }}
            />
            <div
              className="absolute w-40 h-40 sm:w-64 sm:h-64 rounded-full border border-accent/10 animate-pulse-ring"
              style={{ animationDelay: "2s" }}
            />
          </div>

          {/* Particle effects - desktop only */}
          <div className="absolute inset-0 hidden sm:block">
            <Particles />
          </div>

          {/* The Warplet */}
          <div className="relative animate-breathe animate-chomp cursor-pointer select-none warplet-img">
            <img
              src="/warplet.png"
              alt="The Warplet Gobbler"
              className="relative z-10 rounded-full"
              style={{
                maskImage: "radial-gradient(circle, black 55%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(circle, black 55%, transparent 72%)",
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Title area */}
        <div className="text-center mt-4 sm:mt-6 animate-fade-up-delay-1">
          <h1 className="text-2xl sm:text-5xl font-black tracking-tight">
            Feed the <span className="text-primary">Gobbler</span>
          </h1>
          <p className="mt-2 sm:mt-3 text-base-content/50 max-w-md mx-auto text-xs sm:text-base">
            Dutch auction flywheel powered by Superfluid streams.
            <br />
            Deposit Warplets. Drain the pot. Earn $STRAT.
          </p>
        </div>

        {/* Quick stats ribbon */}
        <div className="stats-ribbon justify-center mt-4 sm:mt-8 animate-fade-up-delay-2 w-full sm:gap-6">
          {[
            { label: "Pot", value: "---" },
            { label: "Gobbled", value: "---" },
            { label: "Staked", value: "---" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-base-200/50 border border-base-content/5 backdrop-blur-sm flex-1 sm:flex-initial"
            >
              <span className="text-base sm:text-2xl font-mono font-bold text-primary">
                {stat.value}
              </span>
              <span className="text-[10px] sm:text-xs text-base-content/40">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16 pt-2 sm:pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* The Gobbler */}
          <div className="animate-fade-up-delay-1 group">
            <div className="card bg-base-200/60 border border-primary/10 backdrop-blur-sm animate-card-glow hover:border-primary/30 transition-colors duration-300">
              <div className="card-body gap-3 sm:gap-4 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg sm:text-xl group-hover:bg-primary/20 transition-colors">
                      <span role="img" aria-label="gobbler">
                        &#x1F924;
                      </span>
                    </div>
                    <h2 className="card-title text-base sm:text-lg">The Gobbler</h2>
                  </div>
                  <div className="badge badge-primary badge-outline badge-sm">
                    LIVE
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-base-content/50 leading-relaxed">
                  USDCx streams into the pot via Superfluid. Deposit a Warplet
                  NFT to drain it &mdash; price falls over time as a Dutch
                  auction.
                </p>

                <div className="space-y-3 mt-1 sm:mt-2">
                  <StatBar
                    label="Pot filled"
                    value="-- USDCx"
                    fill={65}
                    color="#00F5FF"
                  />
                  <StatBar
                    label="Time to floor"
                    value="--:--:--"
                    fill={40}
                    color="#7B61FF"
                  />
                </div>

                <button className="btn btn-primary btn-sm mt-1 sm:mt-2 group-hover:shadow-lg group-hover:shadow-primary/20 transition-shadow">
                  Deposit Warplet
                </button>
              </div>
            </div>
          </div>

          {/* Auction */}
          <div className="animate-fade-up-delay-2 group">
            <div className="card bg-base-200/60 border border-secondary/10 backdrop-blur-sm hover:border-secondary/30 transition-colors duration-300">
              <div className="card-body gap-3 sm:gap-4 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-lg sm:text-xl group-hover:bg-secondary/20 transition-colors">
                      <span role="img" aria-label="auction">
                        &#x2694;&#xFE0F;
                      </span>
                    </div>
                    <h2 className="card-title text-base sm:text-lg">Auction</h2>
                  </div>
                  <div className="badge badge-secondary badge-outline badge-sm">
                    BID
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-base-content/50 leading-relaxed">
                  Gobbled Warplets go to auction. Bid $STRAT to win them.
                  Proceeds flow back to stakers.
                </p>

                <div className="mt-1 sm:mt-2 p-3 rounded-xl bg-base-300/50 border border-base-content/5">
                  <div className="text-xs text-base-content/40 mb-1">
                    Current High Bid
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-bold text-secondary">
                    -- <span className="text-sm font-normal">$STRAT</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-1 sm:mt-2">
                  <input
                    type="number"
                    placeholder="Bid amount"
                    className="input input-bordered input-sm flex-1 bg-base-300/50"
                    disabled
                  />
                  <button className="btn btn-secondary btn-sm">Bid</button>
                </div>
              </div>
            </div>
          </div>

          {/* Staking */}
          <div className="animate-fade-up-delay-3 group">
            <div className="card bg-base-200/60 border border-accent/10 backdrop-blur-sm hover:border-accent/30 transition-colors duration-300">
              <div className="card-body gap-3 sm:gap-4 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center text-lg sm:text-xl group-hover:bg-accent/20 transition-colors">
                      <span role="img" aria-label="stake">
                        &#x1F4A0;
                      </span>
                    </div>
                    <h2 className="card-title text-base sm:text-lg">Stake</h2>
                  </div>
                  <div className="badge badge-accent badge-outline badge-sm">
                    EARN
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-base-content/50 leading-relaxed">
                  Stake $STRAT to earn a share of auction proceeds. The longer
                  you stake, the more you earn.
                </p>

                <div className="grid grid-cols-2 gap-3 mt-1 sm:mt-2">
                  <div className="p-2 sm:p-3 rounded-xl bg-base-300/50 border border-base-content/5">
                    <div className="text-xs text-base-content/40 mb-1">
                      Your Stake
                    </div>
                    <div className="text-base sm:text-lg font-mono font-bold">--</div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-base-300/50 border border-base-content/5">
                    <div className="text-xs text-base-content/40 mb-1">
                      Rewards
                    </div>
                    <div className="text-base sm:text-lg font-mono font-bold text-accent">
                      --
                    </div>
                  </div>
                </div>

                <button className="btn btn-accent btn-sm mt-1 sm:mt-2 group-hover:shadow-lg group-hover:shadow-accent/20 transition-shadow">
                  Stake $STRAT
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-10 sm:mt-16 text-center animate-fade-up">
          <h2 className="text-lg sm:text-xl font-bold mb-6 sm:mb-8 text-base-content/70">
            How the Flywheel Works
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 text-sm">
            {[
              {
                step: "1",
                text: "USDCx streams into pot",
                color: "primary",
              },
              { step: "2", text: "Deposit Warplet, drain pot", color: "primary" },
              {
                step: "3",
                text: "Gobbled Warplet goes to auction",
                color: "secondary",
              },
              {
                step: "4",
                text: "$STRAT bids fund stakers",
                color: "accent",
              },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-${item.color}/20 border border-${item.color}/30 flex items-center justify-center text-xs font-bold text-${item.color} shrink-0`}
                >
                  {item.step}
                </div>
                <span className="text-xs sm:text-sm text-base-content/60">{item.text}</span>
                {i < 3 && (
                  <span className="hidden sm:inline text-base-content/20 mx-2">
                    &rarr;
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-base-content/5 py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-base-content/30">
          <span>WarpletGobbler &mdash; built on Base</span>
          <div className="flex gap-4">
            <span className="hover:text-primary cursor-pointer transition-colors">
              Contracts
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              Docs
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              GitHub
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
