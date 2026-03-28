"use client";

import { useEffect, useRef } from "react";

interface GobbleOverlayProps {
  onDone: () => void;
  /** Called when the chest phase begins (phase 6) */
  onChestReveal?: () => void;
  /** USDCx payout to reveal after gobble */
  payout?: number;
}

export default function GobbleOverlay({
  onDone,
  onChestReveal,
  payout = 891.426,
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

    // Chest/reward state
    let chestAlpha = 0,
      chestAlphaT = 0;
    let chestOpen = 0,
      chestOpenT = 0;
    let glowAlpha = 0,
      glowAlphaT = 0;
    let textAlpha = 0,
      textAlphaT = 0;

    // Sparkle particles for reward reveal
    const sparkles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      hue: number;
    }[] = [];

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
        bgCx!.fillStyle = `rgba(4,4,4,${dark})`;
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

      // --- Chest ---
      drawChest(tx!, W / 2, H / 2 + 30, Math.min(W / 500, 1.3));
      drawPayoutText(tx!, W / 2, H / 2 + 30);
      drawSparkles(tx!);
    }

    // ---- Chest images ----
    const chestClosedImg = new Image();
    chestClosedImg.src = "/chest-closed.png";
    const chestOpenImg = new Image();
    chestOpenImg.src = "/chest-open.png";

    function drawChest(
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number,
      scale: number
    ) {
      if (chestAlpha < 0.005) return;

      const imgW = 280 * scale;
      const imgH = (280 / 693) * 360 * scale; // match 693:360 aspect ratio
      const dx = centerX - imgW / 2;
      const dy = centerY - imgH / 2;

      // Golden glow behind chest
      if (glowAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = chestAlpha;
        const glow = ctx.createRadialGradient(centerX, centerY - 20 * scale, 10, centerX, centerY - 20 * scale, 200 * scale);
        glow.addColorStop(0, `rgba(255, 215, 50, ${0.6 * glowAlpha})`);
        glow.addColorStop(0.3, `rgba(255, 180, 0, ${0.25 * glowAlpha})`);
        glow.addColorStop(0.6, `rgba(200, 120, 0, ${0.08 * glowAlpha})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, centerY - 20 * scale, 200 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Light rays when open
      if (glowAlpha > 0.05) {
        const rayCount = 8;
        for (let i = 0; i < rayCount; i++) {
          const angle =
            -Math.PI * 0.15 + (Math.PI * -0.7 * i) / (rayCount - 1);
          const flicker = 0.7 + 0.3 * Math.sin(time * 0.05 + i * 2.1);
          const rayLen = (140 + 40 * flicker) * scale;
          ctx.save();
          ctx.translate(centerX, centerY - 40 * scale);
          ctx.rotate(angle);
          ctx.globalAlpha = chestAlpha * glowAlpha * 0.35 * flicker;
          const rayGrad = ctx.createLinearGradient(0, 0, 0, -rayLen);
          rayGrad.addColorStop(0, "rgba(255, 215, 50, 0.8)");
          rayGrad.addColorStop(0.5, "rgba(255, 180, 0, 0.3)");
          rayGrad.addColorStop(1, "rgba(255, 180, 0, 0)");
          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          ctx.moveTo(-6 * scale, 0);
          ctx.lineTo(-2 * scale, -rayLen);
          ctx.lineTo(2 * scale, -rayLen);
          ctx.lineTo(6 * scale, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw closed chest (fades out as chestOpen approaches 1)
      if (chestOpen < 0.99 && chestClosedImg.complete && chestClosedImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = chestAlpha * (1 - chestOpen);
        ctx.drawImage(chestClosedImg, dx, dy, imgW, imgH);
        ctx.restore();
      }

      // Draw open chest (fades in as chestOpen approaches 1)
      if (chestOpen > 0.01 && chestOpenImg.complete && chestOpenImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = chestAlpha * chestOpen;
        ctx.drawImage(chestOpenImg, dx, dy, imgW, imgH);
        ctx.restore();
      }
    }

    function drawPayoutText(
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number
    ) {
      if (textAlpha < 0.005) return;
      ctx.save();
      ctx.globalAlpha = textAlpha;

      const formatted = payout.toFixed(3);
      const bobY = Math.sin(time * 0.03) * 3;
      const textY = centerY - 160 + bobY;

      ctx.font = "bold 52px 'EB Garamond', Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(255, 215, 50, 0.8)";
      ctx.shadowBlur = 30;
      ctx.fillStyle = "#FFD700";
      ctx.fillText(formatted, centerX, textY);
      ctx.shadowBlur = 0;

      ctx.font = "400 22px 'EB Garamond', Georgia, serif";
      ctx.fillStyle = `rgba(255, 215, 50, ${0.7 * textAlpha})`;
      ctx.fillText("USDCx received", centerX, textY + 40);

      ctx.restore();
    }

    const MAX_SPARKLES = 200;
    function spawnSparkles(centerX: number, centerY: number) {
      if (sparkles.length >= MAX_SPARKLES) return;
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        sparkles.push({
          x: centerX + (Math.random() - 0.5) * 100,
          y: centerY - 80 + (Math.random() - 0.5) * 60,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          life: 1,
          maxLife: 60 + Math.random() * 60,
          size: 2 + Math.random() * 3,
          hue: 40 + Math.random() * 20,
        });
      }
    }

    function drawSparkles(ctx: CanvasRenderingContext2D) {
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.01;
        s.life -= 1 / s.maxLife;
        if (s.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.life * 0.8;
        ctx.fillStyle = `hsl(${s.hue}, 90%, 65%)`;
        ctx.shadowColor = `hsl(${s.hue}, 90%, 65%)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const r = s.size * s.life;
        ctx.moveTo(s.x, s.y - r * 2);
        ctx.lineTo(s.x + r * 0.5, s.y);
        ctx.lineTo(s.x, s.y + r * 2);
        ctx.lineTo(s.x - r * 0.5, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // ---- Update ----
    function update() {
      time++;
      pTopY = topY;
      pBotY = botY;
      const chestCX = W / 2;
      const chestCY = H / 2 + 30;

      const jSpd =
        phase <= 2
          ? 0.008
          : phase >= 3 && phase <= 5
            ? 0.07
            : phase === 9
              ? 0.03
              : 0.02;
      topY = lerp(topY, topT, jSpd);
      botY = lerp(botY, botT, jSpd);
      dark = lerp(dark, darkT, 0.018);
      eyeA = lerp(eyeA, eyeAT, 0.012);
      chestAlpha = lerp(chestAlpha, chestAlphaT, 0.025);
      chestOpen = lerp(chestOpen, chestOpenT, 0.02);
      glowAlpha = lerp(glowAlpha, glowAlphaT, 0.03);
      textAlpha = lerp(textAlpha, textAlphaT, 0.025);
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
          onChestReveal?.();
        }
      }
      if (phase === 6) {
        topT = MID - 180;
        botT = MID + 180;
        darkT = 0.92;
        eyeAT = 0;
        // Wait for jaws to open before showing chest
        if (pt > 60) chestAlphaT = 1;
        if (pt > 160) {
          phase = 7;
          pt = 0;
        }
      }
      if (phase === 7) {
        chestOpenT = 1;
        glowAlphaT = 1;
        darkT = 0.85;
        if (pt > 60) textAlphaT = 1;
        if (pt > 30 && pt % 3 === 0) spawnSparkles(chestCX, chestCY);
        if (pt > 180) {
          phase = 8;
          pt = 0;
        }
      }
      if (phase === 8) {
        if (pt % 8 === 0) spawnSparkles(chestCX, chestCY);
        if (pt > 180) {
          phase = 9;
          pt = 0;
        }
      }
      if (phase === 9) {
        topT = -350;
        botT = H + 350;
        darkT = 0;
        chestAlphaT = 0;
        glowAlphaT = 0;
        textAlphaT = 0;
        if (topY < -100) eyeAT = 0;
        if (topY < -280 && dark < 0.03 && chestAlpha < 0.02) {
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
  }, [onDone, onChestReveal, payout]);

  return (
    <div className="fixed inset-0 z-50" style={{ width: "100vw", height: "100vh" }}>
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
