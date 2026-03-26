"use client";

import { useEffect, useRef } from "react";

export default function GobbleOverlay({ onDone }: { onDone: () => void }) {
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
      window.removeEventListener("resize", onResize);
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
