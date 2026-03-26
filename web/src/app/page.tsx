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

// Ground silhouette only — undulating terrain at bottom of viewport
const ABYSS_TENDRILS: {
  id: number;
  swayDur: number;
  swayFrom: number;
  swayTo: number;
  swayDelay: number;
  fill: string;
  highlight?: string;
}[] = [
  {
    id: 0,
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

    function strokeEdge(edge: { x: number; y: number }[]) {
      cx!.strokeStyle = "rgba(0, 245, 255, 0.2)";
      cx!.lineWidth = 1.5;
      cx!.beginPath();
      for (let i = 0; i < edge.length; i++) {
        if (i === 0) cx!.moveTo(edge[i].x, edge[i].y);
        else cx!.lineTo(edge[i].x, edge[i].y);
      }
      cx!.stroke();
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
      strokeEdge(edge);

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
      strokeEdge(edge);
    }

    function drawDark() {
      if (dark > 0.001) {
        cx!.fillStyle = `rgba(4,4,4,${dark})`;
        cx!.fillRect(0, 0, W, H);
      }
    }

    function update() {
      time++;
      // Phases 1-2: slow creep in; 3-5: chomp; 6: retreat
      const jSpd = phase <= 2 ? 0.008 : phase >= 3 && phase <= 5 ? 0.07 : 0.03;
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
        if (pt > 300) {
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
const MOCK_PRICE_RATE = 0.0274; // USDCx/sec streaming into pot
const MOCK_PRICE_CEIL = 1100; // starting auction price (for fill %)
const MOCK_FLOOR_SECS = 35243; // seconds until floor price (~9h 47m)
const MOCK_GOBBLED = 37;

/** Ambient gobbler peek — jaws creep in from edges every ~45s, then retreat. */
function GobblePeek() {
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

    let cancelled = false;
    let time = 0;
    // Teeth extend 3-17px past topY/botY, so hide position must clear that
    let topY = -40;
    let botY = H + 40;
    let topTarget = -40;
    let botTarget = H + 40;
    const CYCLE = 45 * 60; // ~45s at 60fps
    const PEEK_IN = 180; // frames to hold peek
    let timer = CYCLE - 600; // first peek after ~10s

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    function jagEdge(y: number, dir: number, seed: number) {
      const t = time * 0.006;
      const pts: { x: number; y: number }[] = [];
      for (let x = -10; x <= W + 15; x += 10) {
        const j = sr(Math.floor(x / 10) + seed * 100);
        const h = (j * 14 + 3) * dir;
        const sway = Math.sin(t * 0.5 + x * 0.012 + seed) * 2 * dir;
        pts.push({ x, y: y + h + sway });
        const mx = x + 5;
        const mj = sr(Math.floor(mx / 10) + seed * 200 + 50);
        const mh = (mj * 8 + 6) * dir;
        pts.push({ x: mx, y: y + mh + sway });
      }
      return pts;
    }

    function frame() {
      if (cancelled) return;
      time++;
      timer++;

      // Peek: jaw edge at y=20 means teeth reach y=37, clearly visible
      if (timer > CYCLE && timer <= CYCLE + 10) {
        topTarget = 20;
        botTarget = H - 20;
      } else if (timer > CYCLE + PEEK_IN) {
        topTarget = -40;
        botTarget = H + 40;
        if (topY < -35) timer = 0;
      }

      topY = lerp(topY, topTarget, 0.005);
      botY = lerp(botY, botTarget, 0.005);

      cx!.clearRect(0, 0, W, H);

      if (topY > -38 || botY < H + 38) {
        // Draw jaw fill
        const topEdge = jagEdge(topY, 1, 1);
        cx!.fillStyle = "#040404";
        cx!.beginPath();
        cx!.moveTo(-10, -10);
        cx!.lineTo(W + 10, -10);
        cx!.lineTo(W + 10, topY);
        for (let i = topEdge.length - 1; i >= 0; i--)
          cx!.lineTo(topEdge[i].x, topEdge[i].y);
        cx!.closePath();
        cx!.fill();

        // Subtle cyan edge glow on top teeth
        cx!.strokeStyle = "rgba(0, 245, 255, 0.15)";
        cx!.lineWidth = 1.5;
        cx!.beginPath();
        for (let i = 0; i < topEdge.length; i++) {
          if (i === 0) cx!.moveTo(topEdge[i].x, topEdge[i].y);
          else cx!.lineTo(topEdge[i].x, topEdge[i].y);
        }
        cx!.stroke();

        const botEdge = jagEdge(botY, -1, 5);
        cx!.fillStyle = "#040404";
        cx!.beginPath();
        for (let i = 0; i < botEdge.length; i++) {
          if (i === 0) cx!.moveTo(botEdge[i].x, botEdge[i].y);
          else cx!.lineTo(botEdge[i].x, botEdge[i].y);
        }
        cx!.lineTo(W + 10, H + 10);
        cx!.lineTo(-10, H + 10);
        cx!.closePath();
        cx!.fill();

        // Subtle cyan edge glow on bottom teeth
        cx!.beginPath();
        for (let i = 0; i < botEdge.length; i++) {
          if (i === 0) cx!.moveTo(botEdge[i].x, botEdge[i].y);
          else cx!.lineTo(botEdge[i].x, botEdge[i].y);
        }
        cx!.stroke();
      }

      requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W;
      cv.height = H;
      botY = H + 60;
      botTarget = H + 60;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: "100vw", height: "100vh", zIndex: 1 }}
    />
  );
}

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
            <h1 className="text-3xl sm:text-7xl font-bold tracking-widest uppercase">
              Feed the <span className="text-primary">Gobbler</span>
            </h1>
            <p className="mt-2 sm:mt-3 text-base-content/50 max-w-md mx-auto text-base sm:text-xl">
              Sell your Warplet to The Gobbler for its pot of $USDCx. <br />
              Or wait until the pot grows...
            </p>
            <p className="sm:mt-1 text-base-content/50 max-w-lg mx-auto text-xs sm:text-lg">
              ...and hope no one else steals your chance.
            </p>
          </div>

          {/* Deposit card — just the price and the action */}
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

                <button
                  className="btn btn-primary w-full mt-1 hover:shadow-lg hover:shadow-primary/20 transition-shadow"
                  onClick={() => !gobbling && setGobbling(true)}
                >
                  Sell Warplet to The Gobbler
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Minimal footer */}
        <footer className="relative z-10 py-4 px-4 sm:px-6 text-center">
          <span className="text-sm text-base-content/20">
            WarpletGobbler &mdash; built on Base
          </span>
        </footer>
      </div>
      {/* end gobble fade wrapper */}
    </main>
  );
}
