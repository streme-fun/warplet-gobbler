"use client";

import { ConnectKitButton } from "connectkit";
import { useCallback, useEffect, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element */

// Deterministic particle positions to avoid hydration mismatch
const PARTICLES = [
  {
    id: 0,
    left: "20%",
    delay: "0s",
    size: 3,
    drift: "-10px",
    duration: "2.5s",
    color: "#00F5FF",
  },
  {
    id: 1,
    left: "35%",
    delay: "0.5s",
    size: 4,
    drift: "15px",
    duration: "3s",
    color: "#7B61FF",
  },
  {
    id: 2,
    left: "50%",
    delay: "1s",
    size: 2,
    drift: "-20px",
    duration: "2.8s",
    color: "#FF007A",
  },
  {
    id: 3,
    left: "65%",
    delay: "1.5s",
    size: 5,
    drift: "25px",
    duration: "3.2s",
    color: "#00F5FF",
  },
  {
    id: 4,
    left: "80%",
    delay: "2s",
    size: 3,
    drift: "-15px",
    duration: "2.6s",
    color: "#7B61FF",
  },
  {
    id: 5,
    left: "25%",
    delay: "0.8s",
    size: 4,
    drift: "10px",
    duration: "3.5s",
    color: "#FF007A",
  },
  {
    id: 6,
    left: "45%",
    delay: "2.2s",
    size: 2,
    drift: "-25px",
    duration: "2.4s",
    color: "#00F5FF",
  },
  {
    id: 7,
    left: "70%",
    delay: "0.3s",
    size: 3,
    drift: "20px",
    duration: "3.1s",
    color: "#7B61FF",
  },
  {
    id: 8,
    left: "30%",
    delay: "1.8s",
    size: 5,
    drift: "-5px",
    duration: "2.9s",
    color: "#FF007A",
  },
  {
    id: 9,
    left: "55%",
    delay: "2.5s",
    size: 2,
    drift: "30px",
    duration: "3.4s",
    color: "#00F5FF",
  },
  {
    id: 10,
    left: "75%",
    delay: "1.2s",
    size: 4,
    drift: "-18px",
    duration: "2.7s",
    color: "#7B61FF",
  },
  {
    id: 11,
    left: "40%",
    delay: "0.6s",
    size: 3,
    drift: "12px",
    duration: "3.3s",
    color: "#FF007A",
  },
];

// Parallax warplet field — scattered at different depths, each a unique warplet
const PARALLAX_WARPLETS = [
  // Back layer (slow, small, faint)
  {
    id: 0,
    fid: 4,
    x: 5,
    y: 8,
    size: 40,
    opacity: 0.04,
    speed: 0.02,
    rotate: 12,
    blur: 2,
  },
  {
    id: 1,
    fid: 9,
    x: 25,
    y: 15,
    size: 55,
    opacity: 0.05,
    speed: 0.025,
    rotate: -8,
    blur: 1.5,
  },
  {
    id: 2,
    fid: 20,
    x: 70,
    y: 5,
    size: 45,
    opacity: 0.04,
    speed: 0.02,
    rotate: 20,
    blur: 2,
  },
  {
    id: 3,
    fid: 194,
    x: 85,
    y: 20,
    size: 35,
    opacity: 0.035,
    speed: 0.015,
    rotate: -15,
    blur: 2.5,
  },
  {
    id: 4,
    fid: 239,
    x: 50,
    y: 65,
    size: 50,
    opacity: 0.04,
    speed: 0.02,
    rotate: 5,
    blur: 2,
  },
  {
    id: 5,
    fid: 10,
    x: 15,
    y: 75,
    size: 42,
    opacity: 0.035,
    speed: 0.018,
    rotate: -22,
    blur: 2,
  },
  {
    id: 6,
    fid: 1000,
    x: 90,
    y: 55,
    size: 38,
    opacity: 0.04,
    speed: 0.022,
    rotate: 30,
    blur: 2.5,
  },
  // Mid layer (medium speed, medium size)
  {
    id: 7,
    fid: 1,
    x: 12,
    y: 35,
    size: 65,
    opacity: 0.06,
    speed: 0.05,
    rotate: -5,
    blur: 1,
  },
  {
    id: 8,
    fid: 616,
    x: 42,
    y: 25,
    size: 75,
    opacity: 0.07,
    speed: 0.06,
    rotate: 10,
    blur: 0.5,
  },
  {
    id: 9,
    fid: 3,
    x: 78,
    y: 40,
    size: 60,
    opacity: 0.055,
    speed: 0.045,
    rotate: -18,
    blur: 1,
  },
  {
    id: 10,
    fid: 680,
    x: 55,
    y: 80,
    size: 70,
    opacity: 0.06,
    speed: 0.055,
    rotate: 15,
    blur: 0.5,
  },
  {
    id: 11,
    fid: 5,
    x: 30,
    y: 55,
    size: 55,
    opacity: 0.05,
    speed: 0.04,
    rotate: -12,
    blur: 1,
  },
  {
    id: 12,
    fid: 69,
    x: 92,
    y: 75,
    size: 62,
    opacity: 0.055,
    speed: 0.05,
    rotate: 8,
    blur: 1,
  },
  {
    id: 13,
    fid: 6,
    x: 62,
    y: 45,
    size: 58,
    opacity: 0.05,
    speed: 0.045,
    rotate: -8,
    blur: 1,
  },
  // Front layer (faster, larger, slightly more visible)
  {
    id: 14,
    fid: 99,
    x: 8,
    y: 50,
    size: 90,
    opacity: 0.08,
    speed: 0.1,
    rotate: -3,
    blur: 0,
  },
  {
    id: 15,
    fid: 2,
    x: 65,
    y: 18,
    size: 100,
    opacity: 0.09,
    speed: 0.12,
    rotate: 7,
    blur: 0,
  },
  {
    id: 16,
    fid: 4567,
    x: 35,
    y: 85,
    size: 85,
    opacity: 0.07,
    speed: 0.09,
    rotate: -10,
    blur: 0,
  },
  {
    id: 17,
    fid: 8,
    x: 82,
    y: 70,
    size: 95,
    opacity: 0.08,
    speed: 0.11,
    rotate: 14,
    blur: 0,
  },
];

// Vertical thorny stalks rising from the ground — sharp angular spurs, curving and twisting.
// Each has a fill path (black silhouette) and a highlight path (gray rim-light on one edge).
const ABYSS_TENDRILS: {
  id: number;
  swayDur: number;
  swayFrom: number;
  swayTo: number;
  swayDelay: number;
  fill: string;
  highlight?: string;
}[] = [
  // Far left — tall stalk, tip converges to sharp point at top
  {
    id: 0,
    swayDur: 11,
    swayFrom: -1.5,
    swayTo: 1,
    swayDelay: 0,
    fill: "M24,18 C8,65 2,115 10,165 C20,230 30,290 24,350 C16,420 22,480 28,530 C36,590 46,650 42,710 C36,790 40,860 44,900 L60,900 C52,850 48,780 55,700 C60,640 50,580 42,520 C36,470 30,410 38,340 C44,280 35,220 25,160 C18,115 22,70 30,20Z",
    highlight:
      "M30,20 C22,70 18,115 25,160 C35,220 44,280 38,340 C30,410 36,470 42,520 C50,580 60,640 55,700 C48,780 52,850 55,900",
  },
  // Far-left spur left — pointed tip
  {
    id: 1,
    swayDur: 11,
    swayFrom: -1.5,
    swayTo: 1,
    swayDelay: 0,
    fill: "M36,400 C22,368 5,348 -20,335 C5,350 22,372 34,398Z",
  },
  // Far-left spur right — pointed tip
  {
    id: 2,
    swayDur: 11,
    swayFrom: -1.5,
    swayTo: 1,
    swayDelay: 0,
    fill: "M48,555 C62,528 82,518 110,512 C82,520 63,530 48,550Z",
    highlight: "M48,555 C62,528 82,518 110,512",
  },

  // Left-center — twisting S-curve, sharp tip
  {
    id: 3,
    swayDur: 14,
    swayFrom: -1,
    swayTo: 2,
    swayDelay: 2.5,
    fill: "M219,35 C200,95 205,148 220,195 C205,255 198,318 206,368 C216,428 236,478 242,540 C248,610 232,670 222,740 C212,810 216,870 220,900 L240,900 C228,860 225,800 235,730 C245,660 260,600 255,530 C250,470 230,420 220,360 C212,310 218,250 235,190 C248,145 240,95 225,40Z",
    highlight:
      "M225,40 C240,95 248,145 235,190 C218,250 212,310 220,360 C230,420 250,470 255,530 C260,600 245,660 235,730 C225,800 228,860 230,900",
  },
  // Left-center spur left — pointed
  {
    id: 4,
    swayDur: 14,
    swayFrom: -1,
    swayTo: 2,
    swayDelay: 2.5,
    fill: "M216,384 C192,355 162,342 125,338 C162,348 192,360 214,386Z",
    highlight: "M216,384 C192,355 162,342 125,338",
  },
  // Left-center spur right — pointed
  {
    id: 5,
    swayDur: 14,
    swayFrom: -1,
    swayTo: 2,
    swayDelay: 2.5,
    fill: "M250,562 C278,542 305,535 345,538 C305,540 278,548 252,566Z",
  },

  // Center-left — shorter stalk, sharp tip
  {
    id: 6,
    swayDur: 10,
    swayFrom: -2,
    swayTo: 1,
    swayDelay: 4,
    fill: "M399,360 C382,410 385,458 400,498 C388,545 380,598 386,638 C394,688 402,738 396,790 C390,840 395,878 398,900 L420,900 C410,870 405,830 410,780 C415,730 408,680 400,630 C394,590 400,540 415,490 C425,455 418,410 405,365Z",
    highlight:
      "M405,365 C418,410 425,455 415,490 C400,540 394,590 400,630 C408,680 415,730 410,780 C405,830 410,870 412,900",
  },
  // Center-left spike — pointed
  {
    id: 7,
    swayDur: 10,
    swayFrom: -2,
    swayTo: 1,
    swayDelay: 4,
    fill: "M406,644 C382,618 355,608 325,608 C358,614 382,622 404,646Z",
  },

  // Center — tallest stalk, prominent, sharp tip
  {
    id: 8,
    swayDur: 13,
    swayFrom: -0.8,
    swayTo: 1.2,
    swayDelay: 1,
    fill: "M651,5 C632,82 636,152 650,215 C632,295 624,372 636,438 C652,520 664,600 656,680 C646,770 652,848 654,900 L680,900 C666,840 660,760 670,670 C678,590 665,510 650,430 C638,365 645,290 665,210 C680,150 672,85 658,10Z",
    highlight:
      "M658,10 C672,85 680,150 665,210 C645,290 638,365 650,430 C665,510 678,590 670,670 C660,760 666,840 668,900",
  },
  // Center thorn left — pointed
  {
    id: 9,
    swayDur: 13,
    swayFrom: -0.8,
    swayTo: 1.2,
    swayDelay: 1,
    fill: "M644,454 C618,422 582,410 540,406 C582,416 618,428 642,456Z",
    highlight: "M644,454 C618,422 582,410 540,406",
  },
  // Center thorn right — pointed
  {
    id: 10,
    swayDur: 13,
    swayFrom: -0.8,
    swayTo: 1.2,
    swayDelay: 1,
    fill: "M676,304 C702,278 738,268 780,270 C738,274 705,282 678,306Z",
  },

  // Right-center — curved stalk, sharp tip
  {
    id: 11,
    swayDur: 12,
    swayFrom: -1,
    swayTo: 1.5,
    swayDelay: 3.5,
    fill: "M986,180 C970,242 972,298 985,345 C968,405 962,470 972,528 C986,592 994,658 984,730 C974,805 978,862 980,900 L1000,900 C988,855 985,795 995,720 C1005,650 998,585 985,520 C975,465 980,400 1000,340 C1012,295 1005,245 992,185Z",
    highlight:
      "M992,185 C1005,245 1012,295 1000,340 C980,400 975,465 985,520 C998,585 1005,650 995,720 C985,795 988,855 990,900",
  },
  // Right-center spur — pointed
  {
    id: 12,
    swayDur: 12,
    swayFrom: -1,
    swayTo: 1.5,
    swayDelay: 3.5,
    fill: "M982,544 C958,518 928,506 890,502 C928,510 958,522 980,546Z",
    highlight: "M982,544 C958,518 928,506 890,502",
  },

  // Far right — tall stalk, sharp tip
  {
    id: 13,
    swayDur: 10,
    swayFrom: -1.5,
    swayTo: 2,
    swayDelay: 5,
    fill: "M1298,0 C1305,38 1312,84 1322,135 C1335,205 1342,265 1330,318 C1315,388 1306,452 1316,508 C1328,572 1340,642 1332,710 C1322,790 1326,858 1328,900 L1350,900 C1338,850 1335,780 1345,700 C1352,635 1342,565 1330,500 C1320,445 1328,380 1345,310 C1356,260 1348,200 1335,130 C1325,80 1318,35 1305,0Z",
    highlight:
      "M1305,0 C1318,35 1325,80 1335,130 C1348,200 1356,260 1345,310 C1328,380 1320,445 1330,500 C1342,565 1352,635 1345,700 C1335,780 1338,850 1340,900",
  },
  // Far-right spur left — pointed
  {
    id: 14,
    swayDur: 10,
    swayFrom: -1.5,
    swayTo: 2,
    swayDelay: 5,
    fill: "M1324,524 C1298,498 1265,486 1225,482 C1265,490 1298,502 1322,526Z",
    highlight: "M1324,524 C1298,498 1265,486 1225,482",
  },
  // Far-right spur right — pointed
  {
    id: 15,
    swayDur: 10,
    swayFrom: -1.5,
    swayTo: 2,
    swayDelay: 5,
    fill: "M1354,354 C1380,330 1412,322 1445,322 C1412,328 1382,335 1356,356Z",
  },

  // Ground silhouette — undulating terrain
  {
    id: 16,
    swayDur: 999,
    swayFrom: 0,
    swayTo: 0,
    swayDelay: 0,
    fill: "M-10,900 L-10,870 C60,865 130,858 200,862 C280,867 340,855 400,850 C480,844 540,848 620,855 C700,862 780,858 860,852 C940,846 1020,850 1100,856 C1180,862 1260,855 1340,848 C1380,845 1420,850 1460,858 L1460,900Z",
  },
];

// Scattered void particles — mostly black dots of varying sizes, some white
const VOID_PARTICLES = [
  // Large black blobs
  {
    id: 0,
    left: "5%",
    bottom: "30%",
    size: 8,
    color: "#000",
    opacity: 0.8,
    travel: -350,
    drift: 20,
    dur: 12,
    delay: 0,
  },
  {
    id: 1,
    left: "22%",
    bottom: "25%",
    size: 10,
    color: "#000",
    opacity: 0.7,
    travel: -400,
    drift: -25,
    dur: 14,
    delay: 2,
  },
  {
    id: 2,
    left: "48%",
    bottom: "20%",
    size: 9,
    color: "#000",
    opacity: 0.75,
    travel: -380,
    drift: 15,
    dur: 13,
    delay: 4,
  },
  {
    id: 3,
    left: "72%",
    bottom: "28%",
    size: 7,
    color: "#000",
    opacity: 0.8,
    travel: -320,
    drift: -18,
    dur: 11,
    delay: 1,
  },
  {
    id: 4,
    left: "90%",
    bottom: "22%",
    size: 8,
    color: "#000",
    opacity: 0.7,
    travel: -360,
    drift: 10,
    dur: 12,
    delay: 5,
  },
  // Medium black dots
  {
    id: 5,
    left: "8%",
    bottom: "15%",
    size: 5,
    color: "#000",
    opacity: 0.7,
    travel: -280,
    drift: 15,
    dur: 8,
    delay: 0.5,
  },
  {
    id: 6,
    left: "18%",
    bottom: "35%",
    size: 4,
    color: "#000",
    opacity: 0.6,
    travel: -250,
    drift: -20,
    dur: 9,
    delay: 3,
  },
  {
    id: 7,
    left: "32%",
    bottom: "10%",
    size: 6,
    color: "#000",
    opacity: 0.65,
    travel: -300,
    drift: 25,
    dur: 10,
    delay: 1.5,
  },
  {
    id: 8,
    left: "42%",
    bottom: "40%",
    size: 5,
    color: "#000",
    opacity: 0.7,
    travel: -260,
    drift: -12,
    dur: 7,
    delay: 4.5,
  },
  {
    id: 9,
    left: "55%",
    bottom: "8%",
    size: 4,
    color: "#000",
    opacity: 0.6,
    travel: -290,
    drift: -30,
    dur: 9,
    delay: 2.5,
  },
  {
    id: 10,
    left: "65%",
    bottom: "32%",
    size: 6,
    color: "#000",
    opacity: 0.7,
    travel: -310,
    drift: 22,
    dur: 11,
    delay: 0.8,
  },
  {
    id: 11,
    left: "78%",
    bottom: "12%",
    size: 5,
    color: "#000",
    opacity: 0.65,
    travel: -270,
    drift: -15,
    dur: 8,
    delay: 3.5,
  },
  {
    id: 12,
    left: "88%",
    bottom: "38%",
    size: 4,
    color: "#000",
    opacity: 0.6,
    travel: -240,
    drift: 18,
    dur: 7,
    delay: 6,
  },
  // Small black specks
  {
    id: 13,
    left: "12%",
    bottom: "5%",
    size: 3,
    color: "#000",
    opacity: 0.5,
    travel: -200,
    drift: 8,
    dur: 6,
    delay: 1,
  },
  {
    id: 14,
    left: "28%",
    bottom: "18%",
    size: 2,
    color: "#000",
    opacity: 0.55,
    travel: -180,
    drift: -10,
    dur: 5,
    delay: 3.2,
  },
  {
    id: 15,
    left: "38%",
    bottom: "28%",
    size: 3,
    color: "#000",
    opacity: 0.5,
    travel: -220,
    drift: 14,
    dur: 6.5,
    delay: 5.5,
  },
  {
    id: 16,
    left: "58%",
    bottom: "22%",
    size: 2,
    color: "#000",
    opacity: 0.6,
    travel: -190,
    drift: -8,
    dur: 5.5,
    delay: 0.3,
  },
  {
    id: 17,
    left: "82%",
    bottom: "5%",
    size: 3,
    color: "#000",
    opacity: 0.5,
    travel: -210,
    drift: 12,
    dur: 6,
    delay: 2.8,
  },
  {
    id: 18,
    left: "95%",
    bottom: "15%",
    size: 2,
    color: "#000",
    opacity: 0.55,
    travel: -175,
    drift: -20,
    dur: 5,
    delay: 4.8,
  },
  // White/gray specks (sparse)
  {
    id: 19,
    left: "15%",
    bottom: "42%",
    size: 2,
    color: "#fff",
    opacity: 0.2,
    travel: -160,
    drift: -12,
    dur: 6,
    delay: 1.5,
  },
  {
    id: 20,
    left: "45%",
    bottom: "35%",
    size: 2,
    color: "#fff",
    opacity: 0.15,
    travel: -180,
    drift: 10,
    dur: 7,
    delay: 4,
  },
  {
    id: 21,
    left: "70%",
    bottom: "45%",
    size: 2,
    color: "#fff",
    opacity: 0.2,
    travel: -150,
    drift: -8,
    dur: 5.5,
    delay: 6.5,
  },
  {
    id: 22,
    left: "35%",
    bottom: "48%",
    size: 3,
    color: "#fff",
    opacity: 0.18,
    travel: -200,
    drift: 15,
    dur: 8,
    delay: 2.2,
  },
];

function AbyssBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Full-viewport SVG — thorny stalks with rim-light highlights */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
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
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
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

function GobbleOverlay({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    cv.width = W;
    cv.height = H;
    const MID = H / 2;

    let time = 0;
    let phase = 1;
    let pt = 0;
    let topY = -350,
      botY = H + 350,
      topT = -350,
      botT = H + 350;
    let dark = 0,
      darkT = 0,
      eyeA = 0,
      eyeAT = 0;
    let cancelled = false;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    const VC = "#040404";

    function jagEdge(y: number, dir: number, seed: number) {
      const t = time * 0.008;
      const pts: { x: number; y: number }[] = [];
      for (let x = -10; x <= W + 15; x += 10) {
        const j = sr(Math.floor(x / 10) + seed * 100);
        const h = (j * 14 + 3) * dir;
        const sway = Math.sin(t * 0.7 + x * 0.012 + seed) * 2.5 * dir;
        pts.push({ x, y: y + h + sway });
        const mx = x + 5;
        const mj = sr(Math.floor(mx / 10) + seed * 200 + 50);
        const mh = (mj * 8 + 6) * dir;
        pts.push({ x: mx, y: y + mh + sway });
      }
      return pts;
    }

    function drawUpperJaw() {
      const t = time * 0.01;
      const edge = jagEdge(topY, 1, 1);
      cx!.fillStyle = VC;
      cx!.beginPath();
      cx!.moveTo(-10, -10);
      cx!.lineTo(W + 10, -10);
      cx!.lineTo(W + 10, topY);
      for (let i = edge.length - 1; i >= 0; i--)
        cx!.lineTo(edge[i].x, edge[i].y);
      cx!.closePath();
      cx!.fill();

      if (eyeA > 0.005) {
        const ey = topY - 65 + Math.sin(t * 0.6) * 2;
        for (const ex of [W * 0.34, W * 0.66]) {
          cx!.save();
          cx!.globalAlpha = eyeA;
          const g1 = cx!.createRadialGradient(ex, ey, 0, ex, ey, 120);
          g1.addColorStop(0, `rgba(220,200,255,${0.15 * eyeA})`);
          g1.addColorStop(0.3, `rgba(160,120,220,${0.06 * eyeA})`);
          g1.addColorStop(1, "rgba(0,0,0,0)");
          cx!.fillStyle = g1;
          cx!.beginPath();
          cx!.arc(ex, ey, 120, 0, Math.PI * 2);
          cx!.fill();
          const er = 30;
          cx!.beginPath();
          cx!.arc(ex, ey, er, 0, Math.PI * 2);
          cx!.fillStyle = "rgba(255,245,255,1)";
          cx!.fill();
          cx!.restore();
        }
      }
    }

    function drawLowerJaw() {
      const edge = jagEdge(botY, -1, 5);
      cx!.fillStyle = VC;
      cx!.beginPath();
      for (let i = 0; i < edge.length; i++) {
        if (i === 0) cx!.moveTo(edge[i].x, edge[i].y);
        else cx!.lineTo(edge[i].x, edge[i].y);
      }
      cx!.lineTo(W + 10, H + 10);
      cx!.lineTo(-10, H + 10);
      cx!.closePath();
      cx!.fill();
    }

    function drawDark() {
      if (dark > 0.001) {
        cx!.fillStyle = `rgba(4,4,4,${dark})`;
        cx!.fillRect(0, 0, W, H);
      }
    }

    function update() {
      time++;
      const jSpd = phase >= 3 && phase <= 5 ? 0.07 : phase === 6 ? 0.03 : 0.02;
      topY = lerp(topY, topT, jSpd);
      botY = lerp(botY, botT, jSpd);
      dark = lerp(dark, darkT, 0.018);
      eyeA = lerp(eyeA, eyeAT, 0.012);
      pt++;

      if (phase === 1) {
        darkT = 0.5;
        eyeAT = 1;
        topT = -5;
        botT = H + 5;
        if (pt > 180) {
          phase = 2;
          pt = 0;
        }
      }
      if (phase === 2) {
        topT = MID - 3;
        botT = MID + 3;
        darkT = 0.75;
        if (botY - topY < 18) {
          phase = 3;
          pt = 0;
        }
      }
      if (phase === 3) {
        topT = MID + 14;
        botT = MID - 14;
        darkT = 0.97;
        eyeAT = 1;
        if (pt > 90) {
          phase = 4;
          pt = 0;
        }
      }
      if (phase === 4) {
        const cyc = pt % 90;
        if (cyc < 50) {
          topT = MID - 35;
          botT = MID + 35;
        } else {
          topT = MID + 10;
          botT = MID - 10;
        }
        darkT = 0.88;
        eyeAT = 1;
        if (pt > 270) {
          phase = 5;
          pt = 0;
        }
      }
      if (phase === 5) {
        topT = MID + 12;
        botT = MID - 12;
        darkT = 0.97;
        eyeAT = 1;
        if (pt > 120) {
          phase = 6;
          pt = 0;
        }
      }
      if (phase === 6) {
        topT = -350;
        botT = H + 350;
        darkT = 0;
        // Only fade eyes once jaws are retreating off-screen
        if (topY < -100) eyeAT = 0;
        if (topY < -280 && dark < 0.03) {
          cancelled = true;
          onDone();
        }
      }
    }

    function frame() {
      if (cancelled) return;
      cx!.clearRect(0, 0, W, H);
      drawDark();
      drawLowerJaw();
      drawUpperJaw();
      update();
      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

// Mock constants — Superfluid streaming rate
const MOCK_POT_START = 1247.38291746; // USDCx in pot at page load
const MOCK_POT_RATE = 0.0823; // USDCx/sec streaming in (~7,110/day)
const MOCK_POT_CAP = 2000; // pot capacity for fill bar
const MOCK_PRICE_START = 891.42618; // current Dutch auction price
const MOCK_PRICE_RATE = -0.0274; // price decay per second
const MOCK_PRICE_CEIL = 1100; // starting auction price (for fill %)
const MOCK_FLOOR_SECS = 35243; // seconds until floor price (~9h 47m)
const MOCK_GOBBLED = 37;

/** Streaming number — updates every frame via direct DOM writes, no re-renders. */
function StreamingNumber({
  start,
  perSecond,
  decimals = 8,
  className,
}: {
  start: number;
  perSecond: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      const val = start + elapsed * perSecond;
      if (ref.current) {
        const [whole, frac] = val.toFixed(decimals).split(".");
        // Format whole part with commas
        const formatted = Number(whole).toLocaleString("en-US");
        ref.current.textContent = `${formatted}.${frac}`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, perSecond, decimals]);

  const initial = start.toFixed(decimals);
  const [w, f] = initial.split(".");
  return (
    <span ref={ref} className={className}>
      {Number(w).toLocaleString("en-US")}.{f}
    </span>
  );
}

/** Countdown timer — ticks every second via DOM writes. */
function CountdownTimer({
  startSecs,
  className,
}: {
  startSecs: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      const remaining = Math.max(0, startSecs - elapsed);
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = Math.floor(remaining % 60);
      if (ref.current) {
        ref.current.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startSecs]);

  const h = Math.floor(startSecs / 3600);
  const m = Math.floor((startSecs % 3600) / 60);
  const s = Math.floor(startSecs % 60);
  return (
    <span ref={ref} className={className}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </span>
  );
}

function StatBar({
  label,
  value,
  fill,
  color,
}: {
  label: string;
  value: React.ReactNode;
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
  const [gobbling, setGobbling] = useState(false);
  const handleGobbleDone = useCallback(() => setGobbling(false), []);

  return (
    <main className="min-h-screen relative overflow-hidden noise-overlay flex flex-col">
      {/* Gobble overlay — canvas jaws on top of everything */}
      {gobbling && <GobbleOverlay onDone={handleGobbleDone} />}

      {/* Centered warplet — fixed in viewport center during gobble */}
      {gobbling && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <img
            src="/warplet.png"
            alt=""
            className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] rounded-full animate-breathe"
            style={{
              maskImage: "radial-gradient(circle, black 55%, transparent 72%)",
              WebkitMaskImage:
                "radial-gradient(circle, black 55%, transparent 72%)",
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Hollow Knight Abyss texture — always visible */}
      <AbyssBackground />

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
              <span className="text-primary text-xs sm:text-sm font-bold">
                W
              </span>
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

        {/* Single-focus layout: Gobbler + Deposit */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
          {/* The Gobbler */}
          <div className="relative animate-fade-up">
            {/* Pulse rings */}
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
            <div
              className="relative animate-breathe animate-chomp cursor-pointer select-none warplet-img"
              onClick={() => !gobbling && setGobbling(true)}
            >
              <img
                src="/warplet.png"
                alt="The Warplet Gobbler"
                className="relative z-10 rounded-full"
                style={{
                  maskImage:
                    "radial-gradient(circle, black 55%, transparent 72%)",
                  WebkitMaskImage:
                    "radial-gradient(circle, black 55%, transparent 72%)",
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mt-4 sm:mt-6 animate-fade-up-delay-1">
            <h1 className="text-2xl sm:text-5xl font-black tracking-widest uppercase">
              Feed the <span className="text-primary">Gobbler</span>
            </h1>
            <p className="mt-2 sm:mt-3 text-base-content/50 max-w-sm mx-auto text-xs sm:text-base">
              Deposit a Warplet NFT to drain the pot.
              <br className="hidden sm:block" />
              Price falls over time &mdash; strike when the moment is right.
            </p>
          </div>

          {/* Deposit card — just the price and the action */}
          <div className="mt-6 sm:mt-10 w-full max-w-sm animate-fade-up-delay-2">
            <div className="card bg-base-200/60 border border-primary/10 backdrop-blur-sm animate-card-glow">
              <div className="card-body items-center text-center gap-4 p-5 sm:p-6">
                <p className="text-xs sm:text-sm text-base-content/50">
                  The Gobbler will pay
                </p>
                <div className="text-2xl sm:text-3xl font-mono font-bold text-primary streaming-glow">
                  <StreamingNumber
                    start={MOCK_PRICE_START}
                    perSecond={MOCK_PRICE_RATE}
                    decimals={3}
                  />
                  <span className="text-sm font-normal text-base-content/40 ml-2">
                    USDCx
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-base-content/50">
                  for your Warplet
                </p>

                <button
                  className="btn btn-primary w-full mt-1 hover:shadow-lg hover:shadow-primary/20 transition-shadow"
                  onClick={() => !gobbling && setGobbling(true)}
                >
                  Deposit Warplet
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal footer */}
        <footer className="relative z-10 py-4 px-4 sm:px-6 text-center">
          <span className="text-xs text-base-content/20">
            WarpletGobbler &mdash; built on Base
          </span>
        </footer>
      </div>
      {/* end gobble fade wrapper */}
    </main>
  );
}
