"use client";

import { useEffect, useRef } from "react";

interface GobbleOverlayProps {
  onDone: () => void;
  /** Called when the chest phase begins (phase 6) */
  onChestReveal?: () => void;
  /** Payout amount to reveal after gobble */
  payout?: number;
  payoutSymbol?: string;
  payoutUsd?: number | null;
}

export default function GobbleOverlay({
  onDone,
  onChestReveal,
  payout = 891.426,
  payoutSymbol = "WARPGOBB",
  payoutUsd = null,
}: GobbleOverlayProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const gooRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bgCv = bgRef.current;
    const gooCv = gooRef.current;
    const topCv = topRef.current;
    if (!bgCv || !gooCv || !topCv) return;
    const bgCx = bgCv.getContext("2d");
    const gx = gooCv.getContext("2d");
    const tx = topCv.getContext("2d");
    if (!bgCx || !gx || !tx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let MID = H / 2;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      MID = H / 2;
      for (const cv of [bgCv, gooCv, topCv]) {
        if (!cv) continue;
        cv.width = W;
        cv.height = H;
      }
    }
    resize();
    window.addEventListener("resize", resize);

    let time = 0;
    let phase = 1;
    let pt = 0;
    let topY = -350,
      botY = H + 350,
      topT = -350,
      botT = H + 350;
    let pTopY = -350,
      pBotY = H + 350;
    let dark = 0,
      darkT = 0,
      eyeA = 0,
      eyeAT = 0;
    let cancelled = false;

    // Payout text fade state
    let textAlpha = 0,
      textAlphaT = 0;


    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }
    function sr(s: number) {
      const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    }
    function clamp(v: number, a: number, b: number) {
      return v < a ? a : v > b ? b : v;
    }

    const VC = "#040404";

    // --- Jaw edge blobs: circles that merge with jaw rect via goo filter ---
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

    // --- Drool strand configs ---
    const SN = 16;
    const CPS = 30;
    const strands: {
      xf: number;
      br: number;
      wf: number;
      wa: number;
      ph: number;
      bd: number;
      was: boolean;
    }[] = [];
    for (let i = 0; i < SN; i++) {
      const s = i * 137 + 42;
      strands.push({
        xf: 0.05 + sr(s) * 0.9,
        br: 6 + sr(s + 11) * 9,
        wf: 0.25 + sr(s + 33) * 0.7,
        wa: 5 + sr(s + 55) * 16,
        ph: sr(s + 77) * 6.28,
        bd: 300 + sr(s + 99) * 350,
        was: false,
      });
    }

    // --- Falling droplet pool ---
    const drops: {
      on: boolean;
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
    }[] = [];
    for (let i = 0; i < 40; i++)
      drops.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, a: 1 });

    function spawnDrop(x: number, y: number, r: number) {
      for (const d of drops) {
        if (!d.on) {
          d.on = true;
          d.x = x + (Math.random() - 0.5) * 8;
          d.y = y;
          d.vx = (Math.random() - 0.5) * 1.5;
          d.vy = 0.3 + Math.random() * 2;
          d.r = Math.max(1.5, r * 0.3 + Math.random() * r * 0.5);
          d.a = 1;
          return;
        }
      }
    }

    // ======= BACKGROUND LAYER =======
    function drawBg() {
      bgCx!.fillStyle = "rgba(0,0,0,0)";
      bgCx!.clearRect(0, 0, W, H);
      if (dark > 0.001) {
        bgCx!.fillStyle = `rgba(19,17,28,${dark})`;
        bgCx!.fillRect(0, 0, W, H);
      }
    }

    // ======= GOO LAYER (filtered by CSS) =======
    function drawGoo() {
      const t = time * 0.007;
      gx!.clearRect(0, 0, W, H);
      gx!.fillStyle = VC;

      // Jaw bodies (extend well off-canvas)
      gx!.fillRect(-30, -500, W + 60, 500 + topY + 4);
      gx!.fillRect(-30, botY - 4, W + 60, 500 + H);

      // Edge blobs: organic lip shapes
      for (const b of bumps) {
        const x = b.xf * W;
        const br = Math.sin(t * 0.5 + b.ph) * 2;
        const r = b.r + br;
        const y = b.jaw === 0 ? topY + b.yo + 4 : botY + b.yo - 4;
        gx!.beginPath();
        gx!.arc(x, y, Math.max(1, r), 0, 6.28);
        gx!.fill();
      }

      // Drool strands: chains of circles — the goo filter merges them
      const gap = botY - topY;
      const te = topY + 12;
      const be = botY - 12;
      const jv = Math.abs(topY - pTopY) + Math.abs(botY - pBotY);

      if (gap < 900 && gap > -30) {
        for (const s of strands) {
          const conn = gap < s.bd;
          // spawn droplets on break
          const sx = s.xf * W;
          if (s.was && !conn) {
            const my = (te + be) / 2;
            for (let k = 0; k < 5; k++)
              spawnDrop(
                sx + (Math.random() - 0.5) * 10,
                my + (k - 2) * 10,
                s.br * 0.5
              );
          }
          s.was = conn;
          if (!conn) continue;

          const dist = Math.max(0, be - te);
          const stretch = clamp(gap / s.bd, 0, 1);
          const wobble = Math.sin(t * s.wf + s.ph) * s.wa;
          const jolt = Math.sin(t * 3.5 + s.ph) * clamp(jv * 1.2, 0, 14);

          for (let j = 0; j < CPS; j++) {
            const f = j / (CPS - 1);
            const mid = 1 - Math.abs(f - 0.5) * 2; // 0→1→0
            const mid2 = mid * mid;

            // y: distribute + gravity sag in the middle
            const sag =
              mid2 * gap * 0.22 + Math.sin(t * 0.6 + s.ph + j * 0.4) * 3 * mid;
            const cy = te + dist * f + sag;

            // x: base + wobble strongest in middle
            const cx_ = sx + (wobble + jolt) * mid * 0.6;

            // radius: fat at ends, thin in middle; thins with stretch
            const endBoost = j === 0 || j === CPS - 1 ? 1.5 : 1;
            const rMul = (1 - mid * (0.35 + stretch * 0.45)) * endBoost;
            const r = s.br * rMul * (1 - stretch * 0.25);
            if (r < 0.4) continue;

            gx!.beginPath();
            gx!.arc(cx_, cy, r, 0, 6.28);
            gx!.fill();
          }
        }
      }

      // Ambient drips from upper jaw lip
      if (topY > -300 && Math.random() < 0.15) {
        const dx = Math.random() * W;
        spawnDrop(dx, topY + 10 + Math.random() * 8, 2 + Math.random() * 4);
      }

      // Falling droplets
      for (const d of drops) {
        if (!d.on) continue;
        d.vy += 0.3;
        d.y += d.vy;
        d.x += d.vx;
        d.vx *= 0.98;
        d.a -= 0.008;
        d.r *= 0.998;
        if (d.a <= 0 || d.y > H + 30) {
          d.on = false;
          continue;
        }
        gx!.save();
        gx!.globalAlpha = clamp(d.a, 0, 1);
        gx!.beginPath();
        gx!.arc(d.x, d.y, Math.max(0.5, d.r), 0, 6.28);
        gx!.fill();
        gx!.restore();
      }
    }

    // ======= TOP LAYER: eyes + chest + reward (crisp, no filter) =======
    function drawTop() {
      tx!.clearRect(0, 0, W, H);

      // --- Eyes (kept as-is) ---
      if (eyeA > 0.005) {
        const t = time * 0.01;
        const ey = topY - 65 + Math.sin(t * 0.6) * 2;
        for (const ex of [W * 0.34, W * 0.66]) {
          tx!.save();
          tx!.globalAlpha = eyeA;
          const g1 = tx!.createRadialGradient(ex, ey, 0, ex, ey, 120);
          g1.addColorStop(0, `rgba(220,200,255,${0.15 * eyeA})`);
          g1.addColorStop(0.3, `rgba(160,120,220,${0.06 * eyeA})`);
          g1.addColorStop(1, "rgba(0,0,0,0)");
          tx!.fillStyle = g1;
          tx!.beginPath();
          tx!.arc(ex, ey, 120, 0, Math.PI * 2);
          tx!.fill();
          const er = 30;
          tx!.beginPath();
          tx!.arc(ex, ey, er, 0, Math.PI * 2);
          tx!.fillStyle = "rgba(255,245,255,1)";
          tx!.fill();
          tx!.restore();
        }
      }

      // Payout reveal (no chest) — just the amount text, centered.
      drawPayoutText(tx!, W / 2, H / 2);
    }

    function drawPayoutText(
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number
    ) {
      if (textAlpha < 0.005) return;
      ctx.save();
      ctx.globalAlpha = textAlpha;

      function conciseNumber(n: number) {
        const abs = Math.abs(n);
        const sign = n < 0 ? "-" : "";
        const format = (v: number) =>
          v.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          });

        if (abs >= 1e9) return `${sign}${format(abs / 1e9)}b`;
        if (abs >= 1e6) return `${sign}${format(abs / 1e6)}m`;
        if (abs >= 1e3) return `${sign}${format(abs / 1e3)}k`;
        return `${sign}${format(abs)}`;
      }

      function formatUsd(n: number) {
        return n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      const tokenLabel = payoutSymbol.startsWith("$")
        ? payoutSymbol
        : `$${payoutSymbol}`;
      const formattedTokenAmount = conciseNumber(payout);
      const usdText =
        payoutUsd === null ? "--" : `${formatUsd(Math.max(0, payoutUsd))}`;
      const bobY = Math.sin(time * 0.03) * 3;
      const textY = centerY + bobY;

      // Responsive: clamp big number font so it always fits the viewport
      // with a comfortable margin, and shrink further if the composed text
      // would overflow.
      const maxBigPx = Math.max(22, Math.min(52, W * 0.1));
      const maxSubPx = Math.max(12, Math.min(22, W * 0.045));
      const horizontalBudget = Math.max(160, W - 32);
      const composed = `${formattedTokenAmount} ${tokenLabel}`;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let bigPx = maxBigPx;
      ctx.font = `bold ${bigPx}px 'EB Garamond', Georgia, serif`;
      let measured = ctx.measureText(composed).width;
      if (measured > horizontalBudget) {
        bigPx = Math.max(14, bigPx * (horizontalBudget / measured));
        ctx.font = `bold ${bigPx}px 'EB Garamond', Georgia, serif`;
      }

      ctx.shadowColor = "rgba(255, 215, 50, 0.8)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#FFD700";
      ctx.fillText(composed, centerX, textY);
      ctx.shadowBlur = 0;

      ctx.font = `400 ${maxSubPx}px 'EB Garamond', Georgia, serif`;
      ctx.fillStyle = `rgba(200,200,200, ${0.9 * textAlpha})`;
      ctx.fillText(`~$${usdText}`, centerX, textY + bigPx * 0.85);

      ctx.restore();
    }

    // ---- Update ----
    function update() {
      time++;
      pTopY = topY;
      pBotY = botY;

      const jSpd =
        phase <= 2
          ? 0.04
          : phase >= 3 && phase <= 5
            ? 0.12
            : phase === 9
              ? 0.05
              : 0.04;
      topY = lerp(topY, topT, jSpd);
      botY = lerp(botY, botT, jSpd);
      dark = lerp(dark, darkT, 0.018);
      eyeA = lerp(eyeA, eyeAT, 0.012);
      textAlpha = lerp(textAlpha, textAlphaT, 0.06);
      pt++;

      if (phase === 1) {
        darkT = 0.25;
        eyeAT = 1;
        topT = -5;
        botT = H + 5;
        if (pt > 90) {
          phase = 2;
          pt = 0;
        }
      }
      if (phase === 2) {
        topT = MID - 3;
        botT = MID + 3;
        darkT = 0.3;
        if (botY - topY < 18) {
          phase = 3;
          pt = 0;
        }
      }
      if (phase === 3) {
        topT = MID + 14;
        botT = MID - 14;
        darkT = 0.4;
        eyeAT = 1;
        if (pt > 90) {
          phase = 4;
          pt = 0;
        }
      }
      if (phase === 4) {
        const cyc = pt % 60;
        if (cyc < 30) {
          topT = MID - 35;
          botT = MID + 35;
        } else {
          topT = MID + 10;
          botT = MID - 10;
        }
        darkT = 0.35;
        eyeAT = 1;
        if (pt > 150) {
          phase = 5;
          pt = 0;
        }
      }
      if (phase === 5) {
        topT = MID + 12;
        botT = MID - 12;
        darkT = 0.45;
        eyeAT = 1;
        if (pt > 50) {
          phase = 6;
          pt = 0;
          onChestReveal?.();
        }
      }
      if (phase === 6) {
        // Jaws open and hold; payout text fades in after a short beat.
        topT = MID - 180;
        botT = MID + 180;
        darkT = 0.4;
        eyeAT = 0;
        if (pt > 30) textAlphaT = 1;
        if (pt > 220) {
          phase = 9;
          pt = 0;
        }
      }
      if (phase === 9) {
        topT = -350;
        botT = H + 350;
        darkT = 0;
        textAlphaT = 0;
        if (topY < -100) eyeAT = 0;
        if (topY < -280 && dark < 0.03 && textAlpha < 0.02) {
          cancelled = true;
          onDone();
        }
      }
    }

    function frame() {
      if (cancelled) return;
      drawBg();
      drawGoo();
      drawTop();
      update();
      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
    };
  }, [onDone, onChestReveal, payout, payoutSymbol, payoutUsd]);

  return (
    <div className="fixed inset-0 z-[60]" style={{ width: "100vw", height: "100vh" }}>
      {/* SVG goo filter */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="gobbleGooFilter" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            />
          </filter>
        </defs>
      </svg>
      {/* Background: dark overlay */}
      <canvas
        ref={bgRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
      {/* Goo layer: jaws + drool (filtered) */}
      <canvas
        ref={gooRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%", filter: "url(#gobbleGooFilter)" }}
      />
      {/* Top layer: eyes + chest + reward (crisp) */}
      <canvas
        ref={topRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
