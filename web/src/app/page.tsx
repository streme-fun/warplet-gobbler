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

// Vertical thorny stalks rising from the ground — sharp angular spurs, curving and twisting.
// Each has a fill path (black silhouette) and a highlight path (gray rim-light on one edge).
const ABYSS_TENDRILS: {
  id: number; swayDur: number; swayFrom: number; swayTo: number;
  swayDelay: number; fill: string; highlight?: string;
}[] = [
  // Far left — tall curved stalk with thorn spurs, hooks left
  { id: 0, swayDur: 11, swayFrom: -1.5, swayTo: 1, swayDelay: 0,
    fill: "M60,900 L55,900 C52,850 48,780 55,700 C60,640 50,580 42,520 C36,470 30,410 38,340 C44,280 35,220 25,160 C18,115 22,70 30,20 L18,15 C8,65 2,115 10,165 C20,230 30,290 24,350 C16,420 22,480 28,530 C36,590 46,650 42,710 C36,790 40,860 44,900Z",
    highlight: "M30,20 C22,70 18,115 25,160 C35,220 44,280 38,340 C30,410 36,470 42,520 C50,580 60,640 55,700 C48,780 52,850 55,900" },
  // Far-left thorn spur branching left
  { id: 1, swayDur: 11, swayFrom: -1.5, swayTo: 1, swayDelay: 0,
    fill: "M38,400 C25,370 8,350 -15,335 L-18,342 C5,355 22,375 34,405Z" },
  // Far-left thorn spur branching right
  { id: 2, swayDur: 11, swayFrom: -1.5, swayTo: 1, swayDelay: 0,
    fill: "M45,550 C60,525 80,515 105,510 L106,518 C82,522 63,530 48,555Z",
    highlight: "M45,550 C60,525 80,515 105,510" },

  // Left-center — twisting stalk curving right then left
  { id: 3, swayDur: 14, swayFrom: -1, swayTo: 2, swayDelay: 2.5,
    fill: "M240,900 L230,900 C228,860 225,800 235,730 C245,660 260,600 255,530 C250,470 230,420 220,360 C212,310 218,250 235,190 C248,145 240,95 225,40 L213,35 C200,95 205,148 220,195 C205,255 198,318 206,368 C216,428 236,478 242,540 C248,610 232,670 222,740 C212,810 216,870 220,900Z",
    highlight: "M225,40 C240,95 248,145 235,190 C218,250 212,310 220,360 C230,420 250,470 255,530 C260,600 245,660 235,730 C225,800 228,860 230,900" },
  // Left-center thorn — sharp spur going left
  { id: 4, swayDur: 14, swayFrom: -1, swayTo: 2, swayDelay: 2.5,
    fill: "M220,380 C195,355 165,345 130,340 L128,348 C162,352 190,362 214,386Z",
    highlight: "M220,380 C195,355 165,345 130,340" },
  // Left-center thorn — spur going right
  { id: 5, swayDur: 14, swayFrom: -1, swayTo: 2, swayDelay: 2.5,
    fill: "M248,560 C275,540 300,535 340,538 L341,546 C302,543 278,547 252,566Z" },

  // Center-left — shorter jagged stalk
  { id: 6, swayDur: 10, swayFrom: -2, swayTo: 1, swayDelay: 4,
    fill: "M420,900 L412,900 C410,870 405,830 410,780 C415,730 408,680 400,630 C394,590 400,540 415,490 C425,455 418,410 405,365 L393,360 C382,410 385,458 400,498 C388,545 380,598 386,638 C394,688 402,738 396,790 C390,840 395,878 398,900Z",
    highlight: "M405,365 C418,410 425,455 415,490 C400,540 394,590 400,630 C408,680 415,730 410,780 C405,830 410,870 412,900" },
  // Center-left sharp spike
  { id: 7, swayDur: 10, swayFrom: -2, swayTo: 1, swayDelay: 4,
    fill: "M408,640 C385,615 360,608 330,610 L329,618 C358,616 382,622 404,646Z" },

  // Center — tallest stalk, slight S-curve, prominent
  { id: 8, swayDur: 13, swayFrom: -0.8, swayTo: 1.2, swayDelay: 1,
    fill: "M680,900 L668,900 C666,840 660,760 670,670 C678,590 665,510 650,430 C638,365 645,290 665,210 C680,150 672,85 658,10 L645,5 C632,82 636,152 650,215 C632,295 624,372 636,438 C652,520 664,600 656,680 C646,770 652,848 654,900Z",
    highlight: "M658,10 C672,85 680,150 665,210 C645,290 638,365 650,430 C665,510 678,590 670,670 C660,760 666,840 668,900" },
  // Center thorn left
  { id: 9, swayDur: 13, swayFrom: -0.8, swayTo: 1.2, swayDelay: 1,
    fill: "M648,450 C620,420 585,410 545,408 L544,416 C582,418 616,428 642,456Z",
    highlight: "M648,450 C620,420 585,410 545,408" },
  // Center thorn right
  { id: 10, swayDur: 13, swayFrom: -0.8, swayTo: 1.2, swayDelay: 1,
    fill: "M672,300 C700,275 735,268 775,270 L776,278 C738,276 705,282 678,306Z" },

  // Right-center — curved stalk hooking left
  { id: 11, swayDur: 12, swayFrom: -1, swayTo: 1.5, swayDelay: 3.5,
    fill: "M1000,900 L990,900 C988,855 985,795 995,720 C1005,650 998,585 985,520 C975,465 980,400 1000,340 C1012,295 1005,245 992,185 L980,180 C970,242 972,298 985,345 C968,405 962,470 972,528 C986,592 994,658 984,730 C974,805 978,862 980,900Z",
    highlight: "M992,185 C1005,245 1012,295 1000,340 C980,400 975,465 985,520 C998,585 1005,650 995,720 C985,795 988,855 990,900" },
  // Right-center spur
  { id: 12, swayDur: 12, swayFrom: -1, swayTo: 1.5, swayDelay: 3.5,
    fill: "M985,540 C960,515 930,505 895,502 L894,510 C928,513 955,522 980,546Z",
    highlight: "M985,540 C960,515 930,505 895,502" },

  // Far right — tall stalk curving left at top
  { id: 13, swayDur: 10, swayFrom: -1.5, swayTo: 2, swayDelay: 5,
    fill: "M1350,900 L1340,900 C1338,850 1335,780 1345,700 C1352,635 1342,565 1330,500 C1320,445 1328,380 1345,310 C1356,260 1348,200 1335,130 C1325,80 1318,35 1305,0 L1292,0 C1305,38 1312,84 1322,135 C1335,205 1342,265 1330,318 C1315,388 1306,452 1316,508 C1328,572 1340,642 1332,710 C1322,790 1326,858 1328,900Z",
    highlight: "M1305,0 C1318,35 1325,80 1335,130 C1348,200 1356,260 1345,310 C1328,380 1320,445 1330,500 C1342,565 1352,635 1345,700 C1335,780 1338,850 1340,900" },
  // Far-right spur left
  { id: 14, swayDur: 10, swayFrom: -1.5, swayTo: 2, swayDelay: 5,
    fill: "M1328,520 C1300,495 1268,485 1230,482 L1229,490 C1265,493 1295,502 1322,526Z",
    highlight: "M1328,520 C1300,495 1268,485 1230,482" },
  // Far-right spur right
  { id: 15, swayDur: 10, swayFrom: -1.5, swayTo: 2, swayDelay: 5,
    fill: "M1350,350 C1378,328 1408,320 1440,322 L1441,330 C1410,328 1382,335 1356,356Z" },

  // Ground silhouette — flat dark terrain at bottom
  { id: 16, swayDur: 999, swayFrom: 0, swayTo: 0, swayDelay: 0,
    fill: "M-10,900 L-10,870 C60,865 130,858 200,862 C280,867 340,855 400,850 C480,844 540,848 620,855 C700,862 780,858 860,852 C940,846 1020,850 1100,856 C1180,862 1260,855 1340,848 C1380,845 1420,850 1460,858 L1460,900Z" },
];

// Scattered void particles — mostly black dots of varying sizes, some white
const VOID_PARTICLES = [
  // Large black blobs
  { id: 0, left: "5%", bottom: "30%", size: 8, color: "#000", opacity: 0.8, travel: -350, drift: 20, dur: 12, delay: 0 },
  { id: 1, left: "22%", bottom: "25%", size: 10, color: "#000", opacity: 0.7, travel: -400, drift: -25, dur: 14, delay: 2 },
  { id: 2, left: "48%", bottom: "20%", size: 9, color: "#000", opacity: 0.75, travel: -380, drift: 15, dur: 13, delay: 4 },
  { id: 3, left: "72%", bottom: "28%", size: 7, color: "#000", opacity: 0.8, travel: -320, drift: -18, dur: 11, delay: 1 },
  { id: 4, left: "90%", bottom: "22%", size: 8, color: "#000", opacity: 0.7, travel: -360, drift: 10, dur: 12, delay: 5 },
  // Medium black dots
  { id: 5, left: "8%", bottom: "15%", size: 5, color: "#000", opacity: 0.7, travel: -280, drift: 15, dur: 8, delay: 0.5 },
  { id: 6, left: "18%", bottom: "35%", size: 4, color: "#000", opacity: 0.6, travel: -250, drift: -20, dur: 9, delay: 3 },
  { id: 7, left: "32%", bottom: "10%", size: 6, color: "#000", opacity: 0.65, travel: -300, drift: 25, dur: 10, delay: 1.5 },
  { id: 8, left: "42%", bottom: "40%", size: 5, color: "#000", opacity: 0.7, travel: -260, drift: -12, dur: 7, delay: 4.5 },
  { id: 9, left: "55%", bottom: "8%", size: 4, color: "#000", opacity: 0.6, travel: -290, drift: -30, dur: 9, delay: 2.5 },
  { id: 10, left: "65%", bottom: "32%", size: 6, color: "#000", opacity: 0.7, travel: -310, drift: 22, dur: 11, delay: 0.8 },
  { id: 11, left: "78%", bottom: "12%", size: 5, color: "#000", opacity: 0.65, travel: -270, drift: -15, dur: 8, delay: 3.5 },
  { id: 12, left: "88%", bottom: "38%", size: 4, color: "#000", opacity: 0.6, travel: -240, drift: 18, dur: 7, delay: 6 },
  // Small black specks
  { id: 13, left: "12%", bottom: "5%", size: 3, color: "#000", opacity: 0.5, travel: -200, drift: 8, dur: 6, delay: 1 },
  { id: 14, left: "28%", bottom: "18%", size: 2, color: "#000", opacity: 0.55, travel: -180, drift: -10, dur: 5, delay: 3.2 },
  { id: 15, left: "38%", bottom: "28%", size: 3, color: "#000", opacity: 0.5, travel: -220, drift: 14, dur: 6.5, delay: 5.5 },
  { id: 16, left: "58%", bottom: "22%", size: 2, color: "#000", opacity: 0.6, travel: -190, drift: -8, dur: 5.5, delay: 0.3 },
  { id: 17, left: "82%", bottom: "5%", size: 3, color: "#000", opacity: 0.5, travel: -210, drift: 12, dur: 6, delay: 2.8 },
  { id: 18, left: "95%", bottom: "15%", size: 2, color: "#000", opacity: 0.55, travel: -175, drift: -20, dur: 5, delay: 4.8 },
  // White/gray specks (sparse)
  { id: 19, left: "15%", bottom: "42%", size: 2, color: "#fff", opacity: 0.2, travel: -160, drift: -12, dur: 6, delay: 1.5 },
  { id: 20, left: "45%", bottom: "35%", size: 2, color: "#fff", opacity: 0.15, travel: -180, drift: 10, dur: 7, delay: 4 },
  { id: 21, left: "70%", bottom: "45%", size: 2, color: "#fff", opacity: 0.2, travel: -150, drift: -8, dur: 5.5, delay: 6.5 },
  { id: 22, left: "35%", bottom: "48%", size: 3, color: "#fff", opacity: 0.18, travel: -200, drift: 15, dur: 8, delay: 2.2 },
];

function AbyssBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Full-viewport SVG — thorny stalks with rim-light highlights */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        {ABYSS_TENDRILS.map((t) => (
          <g
            key={t.id}
            className="abyss-tendril-group"
            style={{
              transformOrigin: "50% 100%",
              // @ts-expect-error CSS custom properties
              "--sway-dur": `${t.swayDur}s`,
              "--sway-from": `${t.swayFrom}deg`,
              "--sway-to": `${t.swayTo}deg`,
              "--sway-delay": `${t.swayDelay}s`,
            }}
          >
            <path d={t.fill} fill="#000" />
            {t.highlight && (
              <path
                d={t.highlight}
                fill="none"
                stroke="rgba(180,175,160,0.25)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </g>
        ))}
      </svg>

      {/* Floating void particles — black & white dots */}
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
                      {/* Maw — open void consuming inward */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3"/>
                        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
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
                      {/* Gavel — stylized auction hammer */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-secondary">
                        <rect x="6" y="4" width="8" height="5" rx="1" transform="rotate(-30 10 6.5)" fill="currentColor" opacity="0.8"/>
                        <line x1="12" y1="10" x2="17" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="5" y1="18" x2="19" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
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
                      {/* Arcane flame — staking energy */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
                        <path d="M12 3c0 0-5 5-5 10a5 5 0 0010 0C17 8 12 3 12 3z" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M12 10c0 0-2 2-2 4a2 2 0 004 0c0-2-2-4-2-4z" fill="currentColor" opacity="0.5"/>
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
