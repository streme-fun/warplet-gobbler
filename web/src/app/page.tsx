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

// Flat black SVG tendril paths — organic root/branch shapes that taper to points
// Each tendril group is an SVG anchored to bottom, swaying slowly like underwater
const TENDRIL_GROUPS: {
  id: number; left: string; width: number; height: number;
  swayDur: number; swayFrom: number; swayTo: number; swayDelay: number;
  paths: string[];
}[] = [
  {
    id: 0, left: "-2%", width: 200, height: 500,
    swayDur: 10, swayFrom: -1.5, swayTo: 2, swayDelay: 0,
    paths: [
      // thick trunk splitting into branches
      "M90,500 C88,420 75,350 80,280 C83,240 70,200 65,160 C62,130 55,90 48,40 L50,38 C58,85 66,125 68,155 C73,195 85,235 83,275 C78,345 92,415 95,500Z",
      // left fork
      "M75,300 C65,260 50,230 35,180 C28,155 15,120 5,70 L8,68 C20,115 32,150 40,175 C55,225 68,255 78,295Z",
      // right twig
      "M85,250 C95,220 110,190 120,140 C125,115 135,80 140,30 L143,32 C137,82 128,118 123,145 C113,195 98,225 88,255Z",
      // small spur
      "M60,180 C50,155 38,130 25,95 L28,93 C42,125 53,150 63,175Z",
    ],
  },
  {
    id: 1, left: "12%", width: 160, height: 450,
    swayDur: 12, swayFrom: -2, swayTo: 1.5, swayDelay: 2,
    paths: [
      "M80,450 C78,380 70,310 75,250 C78,210 68,170 60,120 C55,85 45,45 38,0 L42,0 C50,42 58,82 64,115 C72,165 82,205 79,245 C74,305 82,375 85,450Z",
      "M68,280 C55,240 40,200 25,140 C18,110 8,70 0,20 L4,18 C14,65 22,105 30,135 C45,195 58,235 72,275Z",
      "M78,200 C88,170 100,135 108,85 L112,87 C104,138 92,175 82,205Z",
    ],
  },
  {
    id: 2, left: "30%", width: 140, height: 380,
    swayDur: 9, swayFrom: -1, swayTo: 2.5, swayDelay: 4,
    paths: [
      "M70,380 C68,320 60,270 65,220 C68,185 58,145 50,100 C44,65 35,25 30,0 L34,0 C40,22 48,60 55,95 C63,140 72,180 69,215 C64,265 72,315 75,380Z",
      "M58,250 C45,210 30,170 18,110 L22,108 C35,165 48,205 62,245Z",
      "M68,180 C78,150 90,110 95,55 L99,57 C94,115 82,155 72,185Z",
    ],
  },
  {
    id: 3, left: "48%", width: 180, height: 520,
    swayDur: 11, swayFrom: -2, swayTo: 1, swayDelay: 1,
    paths: [
      "M90,520 C88,440 78,370 85,300 C88,255 76,210 68,155 C62,110 50,55 42,0 L46,0 C55,52 66,105 72,150 C80,205 92,250 89,295 C82,365 92,435 95,520Z",
      "M76,320 C60,270 42,225 25,155 C16,120 4,70 0,10 L4,8 C10,65 20,115 30,150 C48,220 64,265 80,315Z",
      "M88,260 C100,225 115,180 125,120 C130,90 140,50 145,5 L149,7 C144,52 134,92 129,125 C119,185 104,230 92,265Z",
      "M65,180 C52,145 35,110 20,60 L24,58 C40,105 55,140 68,175Z",
    ],
  },
  {
    id: 4, left: "65%", width: 150, height: 420,
    swayDur: 13, swayFrom: -1.5, swayTo: 2, swayDelay: 3,
    paths: [
      "M75,420 C73,355 65,295 70,240 C73,200 62,160 55,115 C49,78 40,35 35,0 L39,0 C45,32 53,73 59,110 C67,155 77,195 74,235 C69,290 77,350 80,420Z",
      "M63,270 C50,230 35,185 20,125 L24,123 C40,180 53,225 67,265Z",
      "M73,200 C85,165 98,125 105,65 L109,67 C102,130 89,170 77,205Z",
    ],
  },
  {
    id: 5, left: "82%", width: 180, height: 480,
    swayDur: 10, swayFrom: -2.5, swayTo: 1, swayDelay: 5,
    paths: [
      "M90,480 C88,400 80,340 85,275 C88,235 78,195 70,145 C64,105 55,55 48,0 L52,0 C60,50 68,100 74,140 C82,190 92,230 89,270 C84,335 92,395 95,480Z",
      "M78,300 C65,255 48,210 30,145 C22,112 10,65 2,10 L6,8 C16,60 26,108 35,140 C52,205 68,250 82,295Z",
      "M88,230 C100,195 115,150 122,85 L126,87 C119,155 104,200 92,235Z",
      "M68,170 C55,135 40,95 28,45 L32,43 C45,90 58,130 72,165Z",
    ],
  },
  {
    id: 6, left: "95%", width: 160, height: 400,
    swayDur: 9, swayFrom: -1, swayTo: 3, swayDelay: 2.5,
    paths: [
      "M80,400 C78,340 70,285 75,230 C78,195 68,155 60,110 C54,75 45,35 40,0 L44,0 C50,32 58,70 64,105 C72,150 82,190 79,225 C74,280 82,335 85,400Z",
      "M68,260 C55,220 38,180 22,115 L26,113 C42,175 58,215 72,255Z",
      "M78,190 C90,155 100,115 108,55 L112,57 C104,120 94,160 82,195Z",
    ],
  },
];

// Floating void particles — mix of black and white, drifting upward
const VOID_PARTICLES = [
  { id: 0, left: "6%", bottom: "5%", size: 3, color: "#000", opacity: 0.7, travel: -280, drift: 15, dur: 8, delay: 0 },
  { id: 1, left: "18%", bottom: "12%", size: 2, color: "#fff", opacity: 0.3, travel: -200, drift: -20, dur: 6, delay: 1.5 },
  { id: 2, left: "32%", bottom: "3%", size: 4, color: "#000", opacity: 0.6, travel: -350, drift: 25, dur: 10, delay: 3 },
  { id: 3, left: "42%", bottom: "18%", size: 2, color: "#fff", opacity: 0.25, travel: -180, drift: -10, dur: 5.5, delay: 0.8 },
  { id: 4, left: "55%", bottom: "8%", size: 3, color: "#000", opacity: 0.7, travel: -300, drift: -30, dur: 9, delay: 4.2 },
  { id: 5, left: "65%", bottom: "15%", size: 2, color: "#fff", opacity: 0.35, travel: -160, drift: 18, dur: 6, delay: 2.5 },
  { id: 6, left: "75%", bottom: "2%", size: 3, color: "#000", opacity: 0.65, travel: -260, drift: -22, dur: 7.5, delay: 1 },
  { id: 7, left: "88%", bottom: "10%", size: 2, color: "#fff", opacity: 0.3, travel: -190, drift: 12, dur: 5, delay: 3.5 },
  { id: 8, left: "25%", bottom: "22%", size: 2, color: "#000", opacity: 0.5, travel: -220, drift: 8, dur: 7, delay: 5 },
  { id: 9, left: "50%", bottom: "1%", size: 5, color: "#000", opacity: 0.4, travel: -400, drift: -5, dur: 12, delay: 0.3 },
  { id: 10, left: "78%", bottom: "20%", size: 2, color: "#fff", opacity: 0.2, travel: -150, drift: -15, dur: 5, delay: 6 },
  { id: 11, left: "10%", bottom: "25%", size: 3, color: "#fff", opacity: 0.25, travel: -240, drift: 22, dur: 8, delay: 2 },
];

function AbyssBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Tendril silhouettes — flat black SVGs anchored to bottom */}
      {TENDRIL_GROUPS.map((g) => (
        <div
          key={g.id}
          className="abyss-tendril-group"
          style={{
            position: "absolute",
            bottom: 0,
            left: g.left,
            width: g.width,
            height: g.height,
            // @ts-expect-error CSS custom properties
            "--sway-dur": `${g.swayDur}s`,
            "--sway-from": `${g.swayFrom}deg`,
            "--sway-to": `${g.swayTo}deg`,
            "--sway-delay": `${g.swayDelay}s`,
          }}
        >
          <svg
            viewBox={`0 0 ${g.width} ${g.height}`}
            style={{ width: "100%", height: "100%", overflow: "visible" }}
            preserveAspectRatio="none"
          >
            {g.paths.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </svg>
        </div>
      ))}

      {/* Floating void particles */}
      {VOID_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="void-particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            // @ts-expect-error CSS custom properties
            "--p-opacity": p.opacity,
            "--p-travel": `${p.travel}px`,
            "--p-drift": `${p.drift}px`,
            "--p-dur": `${p.dur}s`,
            "--p-delay": `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

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
        <div
          key={w.id}
          className="absolute warplet-parallax-item"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            width: w.size,
            height: w.size,
            opacity: w.opacity,
            transform: `rotate(${w.rotate}deg)`,
            willChange: w.blur ? undefined : "transform",
            // @ts-expect-error CSS custom properties
            "--drift-duration": `${18 + w.id * 3}s`,
            "--drift-delay": `${w.id * -2.5}s`,
          }}
        >
          <img
            src={`/warplets/warplet-${w.fid}.png`}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 8,
              filter: `grayscale(0.6) brightness(1.5)${w.blur ? ` blur(${w.blur}px)` : ""}`,
            }}
          />
          <div
            className="warplet-void-blob"
            style={{
              // @ts-expect-error CSS custom properties
              "--blob-dur": `${10 + w.id * 2.5}s`,
              "--blob-delay": `${w.id * 1.7}s`,
            }}
          />
        </div>
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

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden noise-overlay">
      {/* Hollow Knight Abyss texture */}
      <AbyssBackground />

      {/* Parallax warplet background */}
      <ParallaxBackground />

      {/* Background gradient orbs — dimmed to work with abyss */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/2 rounded-full blur-3xl" />
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
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      {/* Void mask — the Gobbler's face */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary">
                        <path d="M12 2C7 2 3 6.5 3 11c0 3 1.5 5.5 4 7l1 3h8l1-3c2.5-1.5 4-4 4-7 0-4.5-4-9-9-9z" stroke="currentColor" strokeWidth="1.5"/>
                        <ellipse cx="8.5" cy="10.5" rx="2" ry="2.5" fill="currentColor"/>
                        <ellipse cx="15.5" cy="10.5" rx="2" ry="2.5" fill="currentColor"/>
                      </svg>
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
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                      {/* Nail — the Knight's weapon */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-secondary">
                        <path d="M12 2L9.5 8H11V18H13V8H14.5L12 2Z" fill="currentColor"/>
                        <rect x="10" y="18" width="4" height="2" rx="0.5" fill="currentColor"/>
                        <rect x="9" y="20" width="6" height="2" rx="0.5" fill="currentColor"/>
                      </svg>
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
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      {/* Soul vessel — glowing orb */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
                        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.6"/>
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                      </svg>
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
