"use client";

import { ConnectKitButton } from "connectkit";
import { useEffect, useRef, useState } from "react";
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

// Parallax warplet field — scattered at different depths, each a unique warplet
const PARALLAX_WARPLETS = [
  // Back layer (slow, small, faint)
  { id: 0, fid: 4, x: 5, y: 8, size: 40, opacity: 0.04, speed: 0.02, rotate: 12, blur: 2 },
  { id: 1, fid: 9, x: 25, y: 15, size: 55, opacity: 0.05, speed: 0.025, rotate: -8, blur: 1.5 },
  { id: 2, fid: 20, x: 70, y: 5, size: 45, opacity: 0.04, speed: 0.02, rotate: 20, blur: 2 },
  { id: 3, fid: 194, x: 85, y: 20, size: 35, opacity: 0.035, speed: 0.015, rotate: -15, blur: 2.5 },
  { id: 4, fid: 239, x: 50, y: 65, size: 50, opacity: 0.04, speed: 0.02, rotate: 5, blur: 2 },
  { id: 5, fid: 10, x: 15, y: 75, size: 42, opacity: 0.035, speed: 0.018, rotate: -22, blur: 2 },
  { id: 6, fid: 1000, x: 90, y: 55, size: 38, opacity: 0.04, speed: 0.022, rotate: 30, blur: 2.5 },
  // Mid layer (medium speed, medium size)
  { id: 7, fid: 1, x: 12, y: 35, size: 65, opacity: 0.06, speed: 0.05, rotate: -5, blur: 1 },
  { id: 8, fid: 616, x: 42, y: 25, size: 75, opacity: 0.07, speed: 0.06, rotate: 10, blur: 0.5 },
  { id: 9, fid: 3, x: 78, y: 40, size: 60, opacity: 0.055, speed: 0.045, rotate: -18, blur: 1 },
  { id: 10, fid: 680, x: 55, y: 80, size: 70, opacity: 0.06, speed: 0.055, rotate: 15, blur: 0.5 },
  { id: 11, fid: 5, x: 30, y: 55, size: 55, opacity: 0.05, speed: 0.04, rotate: -12, blur: 1 },
  { id: 12, fid: 69, x: 92, y: 75, size: 62, opacity: 0.055, speed: 0.05, rotate: 8, blur: 1 },
  { id: 13, fid: 6, x: 62, y: 45, size: 58, opacity: 0.05, speed: 0.045, rotate: -8, blur: 1 },
  // Front layer (faster, larger, slightly more visible)
  { id: 14, fid: 99, x: 8, y: 50, size: 90, opacity: 0.08, speed: 0.1, rotate: -3, blur: 0 },
  { id: 15, fid: 2, x: 65, y: 18, size: 100, opacity: 0.09, speed: 0.12, rotate: 7, blur: 0 },
  { id: 16, fid: 4567, x: 35, y: 85, size: 85, opacity: 0.07, speed: 0.09, rotate: -10, blur: 0 },
  { id: 17, fid: 8, x: 82, y: 70, size: 95, opacity: 0.08, speed: 0.11, rotate: 14, blur: 0 },
];

function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const y = window.scrollY;
        const children = containerRef.current?.children;
        if (!children) return;
        PARALLAX_WARPLETS.forEach((w, i) => {
          (children[i] as HTMLElement).style.transform =
            `translateY(${y * w.speed * -1}px) rotate(${w.rotate}deg)`;
        });
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {PARALLAX_WARPLETS.map((w) => (
        <img
          key={w.id}
          src={`/warplets/warplet-${w.fid}.png`}
          alt=""
          draggable={false}
          className="absolute warplet-parallax-item"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: w.size,
            height: w.size,
            opacity: w.opacity,
            filter: `grayscale(0.6) brightness(1.5)${w.blur ? ` blur(${w.blur}px)` : ""}`,
            transform: `rotate(${w.rotate}deg)`,
            willChange: w.blur ? undefined : "transform",
            // @ts-expect-error CSS custom properties
            "--drift-duration": `${18 + w.id * 3}s`,
            "--drift-delay": `${w.id * -2.5}s`,
          }}
        />
      ))}
    </div>
  );
}

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

function ShadowCreature({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const eyeEl = eyesRef.current;

    // Web Animations API — reliable JS-driven animation
    const bodyAnim = el.animate([
      { transform: 'translateY(100%) scale(0.2)', opacity: 0 },
      { transform: 'translateY(20%) scale(0.6)', opacity: 1, offset: 0.12 },
      { transform: 'translateY(-5%) scale(1.0)', opacity: 1, offset: 0.3 },
      { transform: 'translateY(-8%) scale(1.02)', opacity: 1, offset: 0.38 },
      { transform: 'translateY(-10%) scaleX(1.25) scaleY(0.85)', opacity: 1, offset: 0.46 },
      { transform: 'translateY(0%) scaleX(0.92) scaleY(1.15)', opacity: 1, offset: 0.54 },
      { transform: 'translateY(0%) scale(1.05)', opacity: 1, offset: 0.64 },
      { transform: 'translateY(0%) scale(1.0)', opacity: 1, offset: 0.72 },
      { transform: 'translateY(50%) scale(0.5)', opacity: 0.7, offset: 0.86 },
      { transform: 'translateY(120%) scale(0)', opacity: 0 },
    ], { duration: 3500, easing: 'ease-in-out', fill: 'forwards' });

    const eyeAnim = eyeEl?.animate([
      { opacity: 0 },
      { opacity: 0, offset: 0.18 },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, offset: 0.68 },
      { opacity: 0, offset: 0.76 },
      { opacity: 0 },
    ], { duration: 3500, easing: 'linear', fill: 'forwards' });

    return () => { bodyAnim.cancel(); eyeAnim?.cancel(); };
  }, [active]);

  if (!active) return null;

  const FILL = "#1e1a35";
  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '200%',
        height: '200%',
        marginLeft: '-100%',
        marginTop: '-100%',
        zIndex: 20,
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <svg viewBox="0 0 200 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <filter id="goo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <filter id="void-aura" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="0 0 0 0 0.48  0 0 0 0 0.38  0 0 0 0 1  0 0 0 0.9 0" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="eye-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#void-aura)">
          <g filter="url(#goo)">
            <ellipse cx="100" cy="95" rx="60" ry="55" fill={FILL} />
            <circle cx="70" cy="80" r="35" fill={FILL} />
            <circle cx="130" cy="80" r="35" fill={FILL} />
            <circle cx="100" cy="115" r="40" fill={FILL} />
            <circle cx="45" cy="100" r="22" fill={FILL} />
            <circle cx="155" cy="100" r="22" fill={FILL} />
            <ellipse cx="55" cy="148" rx="12" ry="24" fill={FILL} />
            <ellipse cx="80" cy="158" rx="10" ry="30" fill={FILL} />
            <ellipse cx="100" cy="152" rx="14" ry="27" fill={FILL} />
            <ellipse cx="120" cy="158" rx="10" ry="30" fill={FILL} />
            <ellipse cx="145" cy="148" rx="12" ry="24" fill={FILL} />
            <circle cx="80" cy="192" r="6" fill={FILL} />
            <circle cx="120" cy="196" r="5" fill={FILL} />
            <circle cx="100" cy="188" r="7" fill={FILL} />
            <circle cx="75" cy="48" r="18" fill={FILL} />
            <circle cx="100" cy="42" r="16" fill={FILL} />
            <circle cx="125" cy="48" r="18" fill={FILL} />
          </g>
        </g>
        <g ref={eyesRef} filter="url(#eye-glow)" style={{ opacity: 0 }}>
          <ellipse cx="80" cy="80" rx="11" ry="15" fill="white" />
          <ellipse cx="120" cy="80" rx="11" ry="15" fill="white" />
        </g>
      </svg>
    </div>
  );
}

export default function Home() {
  const [isGobbling, setIsGobbling] = useState(false);

  const handleGobble = () => {
    if (isGobbling) return;
    setIsGobbling(true);
    setTimeout(() => setIsGobbling(false), 3500);
  };

  return (
    <main className="min-h-screen relative overflow-hidden noise-overlay">
      {/* Parallax warplet background */}
      <ParallaxBackground />

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

          {/* Shadow creature — outside warplet div so parent transform doesn't affect it */}
          <ShadowCreature active={isGobbling} />

          {/* The Warplet */}
          <div
            className={`relative cursor-pointer select-none warplet-img ${
              isGobbling ? "warplet-being-eaten" : "animate-breathe animate-chomp"
            }`}
            onClick={handleGobble}
          >
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

                <button
                  className="btn btn-primary btn-sm mt-1 sm:mt-2 group-hover:shadow-lg group-hover:shadow-primary/20 transition-shadow"
                  onClick={handleGobble}
                >
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
