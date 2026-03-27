"use client";

import { useEffect, useRef } from "react";

/** Ambient gobbler peek — goo-filter jaws creep in from edges every ~45s, then retreat. */
export default function GobblePeek() {
  const gooRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gooCv = gooRef.current;
    if (!gooCv) return;
    const gx = gooCv.getContext("2d");
    if (!gx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    gooCv.width = W;
    gooCv.height = H;

    let cancelled = false;
    let time = 0;
    let topY = -40;
    let botY = H + 40;
    let topTarget = -40;
    let botTarget = H + 40;
    const CYCLE = 45 * 60;
    const PEEK_IN = 180;
    let timer = CYCLE - 600;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
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

    function frame() {
      if (cancelled) return;
      time++;
      timer++;

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

      gx!.clearRect(0, 0, W, H);

      if (topY > -38 || botY < H + 38) {
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
      }

      requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      gooCv!.width = W;
      gooCv!.height = H;
      botY = H + 40;
      botTarget = H + 40;
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
      <canvas
        ref={gooRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          width: "100vw",
          height: "100vh",
          zIndex: 1,
          filter: "url(#peekGooFilter)",
        }}
      />
    </>
  );
}
