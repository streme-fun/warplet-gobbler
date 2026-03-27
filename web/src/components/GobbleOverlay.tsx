"use client";

import { useEffect, useRef } from "react";

interface GobbleOverlayProps {
  onDone: () => void;
  /** USDCx payout to reveal after gobble */
  payout?: number;
}

export default function GobbleOverlay({
  onDone,
  payout = 891.426,
}: GobbleOverlayProps) {
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
    let MID = H / 2;

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W;
      cv.height = H;
      MID = H / 2;
    };
    window.addEventListener("resize", onResize);

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

    // Chest/reward state
    let chestAlpha = 0;
    let chestAlphaT = 0;
    let chestOpen = 0; // 0 = closed, 1 = fully open
    let chestOpenT = 0;
    let glowAlpha = 0;
    let glowAlphaT = 0;
    let textAlpha = 0;
    let textAlphaT = 0;

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

    // ---- Chest drawing ----

    function drawChest(centerX: number, centerY: number, scale: number) {
      if (chestAlpha < 0.005) return;
      cx!.save();
      cx!.globalAlpha = chestAlpha;
      cx!.translate(centerX, centerY);
      cx!.scale(scale, scale);

      const cw = 120; // chest half-width
      const ch = 70; // chest body height
      const lidH = 40; // lid height

      // Lid opening angle
      const lidAngle = chestOpen * -1.2; // radians, opens backward

      // Golden glow behind chest when opening
      if (glowAlpha > 0.01) {
        const glow = cx!.createRadialGradient(0, -ch * 0.3, 10, 0, -ch * 0.3, 200);
        glow.addColorStop(0, `rgba(255, 215, 50, ${0.6 * glowAlpha})`);
        glow.addColorStop(0.3, `rgba(255, 180, 0, ${0.25 * glowAlpha})`);
        glow.addColorStop(0.6, `rgba(200, 120, 0, ${0.08 * glowAlpha})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        cx!.fillStyle = glow;
        cx!.beginPath();
        cx!.arc(0, -ch * 0.3, 200, 0, Math.PI * 2);
        cx!.fill();
      }

      // --- Chest body (trapezoid) ---
      cx!.fillStyle = "#5a3a1a";
      cx!.strokeStyle = "#8B6914";
      cx!.lineWidth = 2;
      cx!.beginPath();
      cx!.moveTo(-cw, 0);
      cx!.lineTo(cw, 0);
      cx!.lineTo(cw * 0.92, -ch);
      cx!.lineTo(-cw * 0.92, -ch);
      cx!.closePath();
      cx!.fill();
      cx!.stroke();

      // Body detail: horizontal band
      cx!.fillStyle = "#8B6914";
      cx!.fillRect(-cw, -ch * 0.45, cw * 2, 8);

      // Body detail: lock plate
      cx!.fillStyle = "#DAA520";
      cx!.beginPath();
      cx!.arc(0, -ch * 0.45, 14, 0, Math.PI * 2);
      cx!.fill();
      cx!.fillStyle = "#5a3a1a";
      cx!.beginPath();
      cx!.arc(0, -ch * 0.45, 6, 0, Math.PI * 2);
      cx!.fill();

      // --- Lid (rotates around top hinge) ---
      cx!.save();
      cx!.translate(0, -ch);
      cx!.rotate(lidAngle);

      cx!.fillStyle = "#6B4420";
      cx!.strokeStyle = "#8B6914";
      cx!.lineWidth = 2;
      cx!.beginPath();
      cx!.moveTo(-cw * 0.92, 0);
      cx!.lineTo(cw * 0.92, 0);
      cx!.lineTo(cw * 0.84, -lidH * 0.6);
      // Rounded top
      cx!.quadraticCurveTo(0, -lidH * 1.1, -cw * 0.84, -lidH * 0.6);
      cx!.closePath();
      cx!.fill();
      cx!.stroke();

      // Lid band
      cx!.fillStyle = "#8B6914";
      const bandY = -lidH * 0.22;
      cx!.fillRect(-cw * 0.88, bandY, cw * 1.76, 5);

      // Lid latch
      cx!.fillStyle = "#DAA520";
      cx!.beginPath();
      cx!.arc(0, 3, 10, 0, Math.PI * 2);
      cx!.fill();

      cx!.restore(); // lid transform

      // Light rays when open
      if (glowAlpha > 0.05) {
        const rayCount = 8;
        for (let i = 0; i < rayCount; i++) {
          const angle = -Math.PI * 0.15 + (Math.PI * -0.7 * i) / (rayCount - 1);
          const flicker = 0.7 + 0.3 * Math.sin(time * 0.05 + i * 2.1);
          const rayLen = 140 + 40 * flicker;
          cx!.save();
          cx!.translate(0, -ch);
          cx!.rotate(angle);
          cx!.globalAlpha = glowAlpha * 0.35 * flicker;
          const rayGrad = cx!.createLinearGradient(0, 0, 0, -rayLen);
          rayGrad.addColorStop(0, "rgba(255, 215, 50, 0.8)");
          rayGrad.addColorStop(0.5, "rgba(255, 180, 0, 0.3)");
          rayGrad.addColorStop(1, "rgba(255, 180, 0, 0)");
          cx!.fillStyle = rayGrad;
          cx!.beginPath();
          cx!.moveTo(-6, 0);
          cx!.lineTo(-2, -rayLen);
          cx!.lineTo(2, -rayLen);
          cx!.lineTo(6, 0);
          cx!.closePath();
          cx!.fill();
          cx!.restore();
        }
      }

      cx!.restore(); // main chest transform
    }

    function drawPayoutText(centerX: number, centerY: number) {
      if (textAlpha < 0.005) return;
      cx!.save();
      cx!.globalAlpha = textAlpha;

      const formatted = payout.toFixed(3);
      const bobY = Math.sin(time * 0.03) * 3;

      // Payout amount
      cx!.font = "bold 52px 'EB Garamond', Georgia, serif";
      cx!.textAlign = "center";
      cx!.textBaseline = "middle";

      const textY = centerY - 160 + bobY;

      // Text glow
      cx!.shadowColor = "rgba(255, 215, 50, 0.8)";
      cx!.shadowBlur = 30;
      cx!.fillStyle = "#FFD700";
      cx!.fillText(formatted, centerX, textY);
      cx!.shadowBlur = 0;

      // "USDCx" label
      cx!.font = "400 22px 'EB Garamond', Georgia, serif";
      cx!.fillStyle = `rgba(255, 215, 50, ${0.7 * textAlpha})`;
      cx!.fillText("USDCx received", centerX, textY + 40);

      cx!.restore();
    }

    function spawnSparkles(centerX: number, centerY: number) {
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
          hue: 40 + Math.random() * 20, // gold range
        });
      }
    }

    function drawSparkles() {
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.01; // slight gravity
        s.life -= 1 / s.maxLife;
        if (s.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        cx!.save();
        cx!.globalAlpha = s.life * 0.8;
        cx!.fillStyle = `hsl(${s.hue}, 90%, 65%)`;
        cx!.shadowColor = `hsl(${s.hue}, 90%, 65%)`;
        cx!.shadowBlur = 8;
        // Draw a 4-point star
        cx!.beginPath();
        const r = s.size * s.life;
        cx!.moveTo(s.x, s.y - r * 2);
        cx!.lineTo(s.x + r * 0.5, s.y);
        cx!.lineTo(s.x, s.y + r * 2);
        cx!.lineTo(s.x - r * 0.5, s.y);
        cx!.closePath();
        cx!.fill();
        cx!.restore();
      }
    }

    // ---- Update & Frame ----

    function update() {
      time++;
      const chestCX = W / 2;
      const chestCY = H / 2 + 30;

      // Phases 1-2: slow creep in; 3-5: chomp; 6-8: chest reward; 9: retreat
      const jSpd =
        phase <= 2 ? 0.008 : phase >= 3 && phase <= 5 ? 0.07 : 0.03;
      topY = lerp(topY, topT, jSpd);
      botY = lerp(botY, botT, jSpd);
      dark = lerp(dark, darkT, 0.018);
      eyeA = lerp(eyeA, eyeAT, 0.012);
      chestAlpha = lerp(chestAlpha, chestAlphaT, 0.025);
      chestOpen = lerp(chestOpen, chestOpenT, 0.02);
      glowAlpha = lerp(glowAlpha, glowAlphaT, 0.03);
      textAlpha = lerp(textAlpha, textAlphaT, 0.025);
      pt++;

      // Phase 1: Jaws creep in from offscreen
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
      // Phase 2: Jaws close to midline
      if (phase === 2) {
        topT = MID - 3;
        botT = MID + 3;
        darkT = 0.75;
        if (botY - topY < 18) {
          phase = 3;
          pt = 0;
        }
      }
      // Phase 3: Jaws overlap (chomp)
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
      // Phase 4: Chewing — jaws open/close repeatedly
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
      // Phase 5: Final chomp
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
      // Phase 6: Jaws part, chest materializes
      if (phase === 6) {
        topT = MID - 180;
        botT = MID + 180;
        darkT = 0.92;
        eyeAT = 0;
        chestAlphaT = 1;
        if (pt > 100) {
          phase = 7;
          pt = 0;
        }
      }
      // Phase 7: Chest opens, golden glow bursts out
      if (phase === 7) {
        chestOpenT = 1;
        glowAlphaT = 1;
        darkT = 0.85;
        if (pt > 60) {
          textAlphaT = 1;
        }
        // Spawn sparkles while chest is opening
        if (pt > 30 && pt % 3 === 0) {
          spawnSparkles(chestCX, chestCY);
        }
        if (pt > 180) {
          phase = 8;
          pt = 0;
        }
      }
      // Phase 8: Hold — let user see the payout
      if (phase === 8) {
        // Gentle sparkles continue
        if (pt % 8 === 0) {
          spawnSparkles(chestCX, chestCY);
        }
        if (pt > 180) {
          phase = 9;
          pt = 0;
        }
      }
      // Phase 9: Everything fades, jaws retreat
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
      cx!.clearRect(0, 0, W, H);
      drawDark();
      drawLowerJaw();
      drawUpperJaw();
      // Draw chest and reward between jaws
      const chestCX = W / 2;
      const chestCY = H / 2 + 30;
      const chestScale = Math.min(W / 500, 1.3);
      drawChest(chestCX, chestCY, chestScale);
      drawPayoutText(chestCX, chestCY);
      drawSparkles();
      update();
      requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [onDone, payout]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
