"use client";

import { useEffect, useRef } from "react";

/** Always-visible gobbler — jaws + eyes frame the screen, mouth open until gobble. */
export default function GobblePeek() {
  const gooRef = useRef<HTMLCanvasElement>(null);
  const eyeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gooCv = gooRef.current;
    const eyeCv = eyeRef.current;
    if (!gooCv || !eyeCv) return;
    const gx = gooCv.getContext("2d");
    const ex = eyeCv.getContext("2d");
    if (!gx || !ex) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    gooCv.width = W;
    gooCv.height = H;
    eyeCv.width = W;
    eyeCv.height = H;

    let cancelled = false;
    let time = 0;
    // Responsive: smaller jaws + eyes on mobile
    const mobile = () => W < 640;
    const restTop = () => (mobile() ? 120 : 190);
    const restBot = () => (mobile() ? 110 : 180);
    let topY = restTop();
    let botY = H - restBot();

    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }

    const VC = "#040404";

    // Jaw edge blobs
    const bumps: {
      jaw: number;
      xf: number;
      r: number;
      yo: number;
      ph: number;
    }[] = [];
    for (let jaw = 0; jaw < 2; jaw++) {
      for (let i = 0; i < 60; i++) {
        const s = jaw * 1000 + i * 31;
        bumps.push({
          jaw,
          xf: (i + 0.3 + sr(s) * 0.4) / 60,
          r: 6 + sr(s + 11) * 13,
          yo: sr(s + 23) * 4 - 2,
          ph: sr(s + 37) * 6.28,
        });
      }
    }

    function drawEyes(topJawY: number) {
      ex!.clearRect(0, 0, W, H);

      const m = mobile();
      const glowR = m ? 60 : 120;
      const orbR = m ? 16 : 30;
      const eyeOffset = m ? 35 : 65;

      const t = time * 0.01;
      // Top jaw eyes
      const ey = topJawY - eyeOffset + Math.sin(t * 0.6) * 2;
      for (const eyeX of [W * 0.34, W * 0.66]) {
        ex!.save();
        // Ambient glow
        const g1 = ex!.createRadialGradient(eyeX, ey, 0, eyeX, ey, glowR);
        g1.addColorStop(0, "rgba(220,200,255,0.10)");
        g1.addColorStop(0.3, "rgba(160,120,220,0.04)");
        g1.addColorStop(1, "rgba(0,0,0,0)");
        ex!.fillStyle = g1;
        ex!.beginPath();
        ex!.arc(eyeX, ey, glowR, 0, Math.PI * 2);
        ex!.fill();
        // Eye orb
        ex!.beginPath();
        ex!.arc(eyeX, ey, orbR, 0, Math.PI * 2);
        ex!.fillStyle = "rgba(255,245,255,1)";
        ex!.fill();
        ex!.restore();
      }
    }

    function frame() {
      if (cancelled) return;
      time++;

      // Subtle breathing: jaws shift ±4px slowly
      const breath = Math.sin(time * 0.008) * 4;
      topY = restTop() + breath;
      botY = H - restBot() - breath;

      gx!.clearRect(0, 0, W, H);

      const t = time * 0.007;
      gx!.fillStyle = VC;

      // Jaw bodies
      gx!.fillRect(-30, -500, W + 60, 500 + topY + 4);
      gx!.fillRect(-30, botY - 4, W + 60, 500 + H);

      // Edge blobs
      for (const b of bumps) {
        const x = b.xf * W;
        const br = Math.sin(t * 0.5 + b.ph) * 2;
        const r = b.r + br;
        const y = b.jaw === 0 ? topY + b.yo + 4 : botY + b.yo - 4;
        gx!.beginPath();
        gx!.arc(x, y, Math.max(1, r), 0, 6.28);
        gx!.fill();
      }

      // Eyes on separate unfiltered canvas
      drawEyes(topY);

      requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      if (!gooCv || !eyeCv) return;
      W = window.innerWidth;
      H = window.innerHeight;
      gooCv.width = W;
      gooCv.height = H;
      eyeCv.width = W;
      eyeCv.height = H;
      botY = H - restBot();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="peekGooFilter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
        </defs>
      </svg>
      {/* Goo-filtered jaw canvas */}
      <canvas
        ref={gooRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 40,
          filter: "url(#peekGooFilter)",
        }}
      />
      {/* Crisp eye canvas (no goo filter) */}
      <canvas
        ref={eyeRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 46,
        }}
      />
    </>
  );
}
